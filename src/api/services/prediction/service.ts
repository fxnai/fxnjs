/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import { isBrowser, isDeno, isNode, isWebWorker } from "browser-or-node"
import { nanoid } from "nanoid"
import { GraphClient } from "../../graph"
import { Prediction, PlainValue, Value, PredictorType } from "../../types"
import { toFunctionValue, toPlainValue } from "../value"
import { StorageService } from "../storage"
import { toPlainValue as edgeToPlainValue, toFunctionValue as valueToEdgeValue } from "./edge"

export const PREDICTION_FIELDS = `
id
tag
type
created
implementation
configuration
resources {
    id
    url
}
results {
    data
    type
    shape
}
latency
error
logs
`;

export interface CreatePredictionInput {
    /**
     * Predictor tag.
     */
    tag: string;
    /**
     * Input values.
     */
    inputs?: Record<string, PlainValue | Value>;
    /**
     * Do not populate convenience fields in output values.
     * This defaults to `false`.
     */
    rawOutputs?: boolean;
    /**
     * Return a data URL if an output value is smaller than this limit (in bytes).
     */
    dataUrlLimit?: number;
}

export interface DeletePredictionInput {
    /**
     * Predictor tag.
     */
    tag: string;
}

interface EdgePredictor {
    module: any;
    handle: number;
}

type EdgePrediction = Pick<Prediction, "results" | "latency" | "error" | "logs">;

export class PredictionService {

    private readonly client: GraphClient;
    private readonly storage: StorageService;
    private readonly cache: Map<string, EdgePredictor>;

    public constructor (client: GraphClient, storage: StorageService) {
        this.client = client;
        this.storage = storage;
        this.cache = new Map<string, EdgePredictor>();
    }

    /**
     * Create a prediction.
     * @param input Prediction input.
     * @returns Prediction.
     */
    public async create (input: CreatePredictionInput): Promise<Prediction> {
        const { tag, inputs: rawInputs, rawOutputs, dataUrlLimit } = input;
        // Check if cached
        if (this.cache.has(tag))
            return {
                id: nanoid(),
                tag,
                type: PredictorType.Edge,
                created: new Date().toISOString() as unknown as Date,
                ...await this.predict(this.cache.get(tag), input),
            }
        // Serialize inputs
        const inputObject = await serializeCloudInputs(rawInputs, this.storage);
        const inputs = inputObject ? Object.entries(inputObject).map(([name, value]) => ({ ...value, name })) : null;
        // Query
        const { data: { prediction } } = await this.client.query<{ prediction: Prediction }>(
            `mutation ($input: CreatePredictionInput!) {
                prediction: createPrediction (input: $input) {
                    ${PREDICTION_FIELDS}
                }
            }`,
            { input: { tag, inputs, client, dataUrlLimit } }
        );
        // Parse
        const predictor = prediction.type === PredictorType.Edge ? await this.load(prediction) : null;
        const { results: edgeResults, latency: edgeLatency, error: edgeError, logs: edgeLogs } = !!predictor && !!rawInputs ?
            await this.predict(predictor, input) :
            { } as EdgePrediction;
        const results = edgeResults ?? await deserializeCloudOutputs(prediction.results as Value[], rawOutputs);
        const latency = edgeLatency ?? prediction.latency;
        const error = edgeError ?? prediction.error;
        const logs = edgeLogs ?? prediction.logs;
        // Return
        return { ...prediction, results, latency, error, logs };
    }

    /**
     * Create a streaming prediction.
     * NOTE: This feature is currently experimental.
     * @param input Prediction input.
     * @returns Generator which asynchronously returns prediction results as they are streamed from the predictor.
     */
    public async * stream (input: CreatePredictionInput): AsyncGenerator<Prediction> { // TODO // Edge support
        const { tag, inputs: rawInputs, rawOutputs, dataUrlLimit } = input;
        // Serialize inputs
        const inputs = await serializeCloudInputs(rawInputs, this.storage);
        // Request
        const url = new URL(`/predict/${tag}`, this.client.url);
        url.searchParams.append("rawOutputs", "true");
        url.searchParams.append("stream", "true");
        url.searchParams.append("dataUrlLimit", dataUrlLimit?.toString());
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": this.client.auth,
                "fxn-client": client
            },
            body: JSON.stringify(inputs)
        });
        // Stream
        const decoder = new TextDecoderStream();
        const reader = response.body.pipeThrough(decoder).getReader();
        let done, value;
        while (!done) {
            ({ value, done } = await reader.read());
            if (done)
                break;
            const payload = JSON.parse(value) as Prediction;
            if (response.status >= 400)
                throw new Error(payload.error);
            const results = await deserializeCloudOutputs(payload.results as Value[], rawOutputs);
            const prediction: Prediction = { ...payload, results };    
            yield prediction;
        }
    }
    
    /**
     * Delete an edge predictor that is loaded in memory.
     * @param input Input arguments.
     * @returns Whether the edge predictor was successfully deleted from memory.
     */
    public async delete (input: DeletePredictionInput): Promise<boolean> {
        const { tag } = input;
        // Check
        if (!this.cache.has(tag))
            return false;
        // Pop from cache
        const { module, handle } = this.cache.get(tag);
        this.cache.delete(tag);
        // Release predictor
        const status = module._FXNPredictorRelease(handle);
        return status === 0;
    }

    private async load (prediction: Prediction): Promise<EdgePredictor> {
        const { tag, implementation, resources } = prediction;
        const predictor = await new Promise<EdgePredictor>(async (resolve, reject) => {
            const script = document.createElement("script");
            script.src = implementation;
            script.onload = async () => {
                const name = tag.substring(1).replace("-", "_").replace("/", "_");
                const wasmPath = resources.filter(r => r.id === "wasm")[0].url;
                const locateFile = (path: string) => path.endsWith(".wasm") ? wasmPath : path;
                const dynamicLibraries = resources.filter(r => r.id === "fxn").map(r => r.url);
                const moduleLoader = (window as any)[name];
                // Check
                if (!moduleLoader) {
                    reject(`Function Error: Failed to create prediction for ${tag} because implementation is invalid`);
                    return;
                }
                // Load module
                let module: any = undefined;
                try {
                    module = await moduleLoader({ locateFile, dynamicLibraries });
                } catch (err) {
                    reject(`Function Error: Failed to create prediction for ${tag} with error: ${err}`);
                    return;
                }
                // Create predictor
                const pTag = module._malloc(tag.length + 1);
                const pHandle = module._malloc(4);
                module.stringToUTF8(tag, pTag, tag.length + 1);
                const status = module._FXNPredictorCreate(pTag, 0, pHandle); // TODO // Configuration
                module._free(pTag);
                // Check status
                if (status !== 0) {
                    reject(`Function Error: Failed to create prediction for ${tag} with status: ${status}`);
                    return;
                }
                // Get handle
                const handle = module.getValue(pHandle, "*");
                module._free(pHandle);
                // Resolve
                resolve({ module, handle });
            };
            script.onerror = error => reject(`Function Error: Failed to create edge prediction ${tag} with error: ${error}`);
            document.body.appendChild(script);
        });
        // Cache
        this.cache.set(tag, predictor);
        // Return
        return predictor;
    }

    private async predict (predictor: EdgePredictor, request: CreatePredictionInput): Promise<EdgePrediction> { // TODO // Logs and error
        const { module, handle } = predictor;
        const { tag, inputs } = request;
        const results: PlainValue[] = [];
        const startTime = performance.now();
        const ppInputs = module._malloc(4);
        const ppOutputs = module._malloc(4);
        const pOutputCount = module._malloc(4);
        let pInputs = 0;
        let pOutputs = 0;
        let status = 0;
        try {
            // Create input map
            status = module._FXNValueMapCreate(ppInputs);
            if (status !== 0)
                throw new Error(`Function failed to create prediction for ${tag} because input value map could not be created with status: ${status}`);
            pInputs = module.getValue(ppInputs, "*");
            // Marshal inputs
            for (const [key, value] of Object.entries(inputs)) {
                const pValue = valueToEdgeValue(value, module);
                const pKey = module._malloc(key.length + 1);
                module.stringToUTF8(key, pKey, key.length + 1);
                module._FXNValueMapSetValue(pInputs, pKey, pValue);
                module._free(pKey);
            }
            // Make prediction
            status = module._FXNPredictorPredict(handle, pInputs, ppOutputs);
            if (status !== 0)
                throw new Error(`Function failed to create prediction for ${tag} with status: ${status}`);
            // Marshal outputs
            pOutputs = module.getValue(ppOutputs, "*");
            module._FXNValueMapGetSize(pOutputs, pOutputCount);
            const outputCount = module.HEAP32[pOutputCount / 4];
            for (let idx = 0; idx < outputCount; idx++) {
                const MAX_KEY_LEN = 256;
                const pKey = module._malloc(MAX_KEY_LEN);
                const ppValue = module._malloc(4);
                module._FXNValueMapGetKey(pOutputs, idx, pKey, MAX_KEY_LEN);
                module._FXNValueMapGetValue(pOutputs, pKey, ppValue);
                const pValue = module.getValue(ppValue, "*");
                const value = edgeToPlainValue(pValue, module);
                results.push(value);
                module._free(pKey);
                module._free(ppValue);
            }
            // Return
            const latency = performance.now() - startTime;
            return { results, latency, error: null, logs: "" };
        } catch (error) {
            throw error;
        } finally {
            module._FXNValueMapRelease(pInputs);
            module._FXNValueMapRelease(pOutputs);
            module._free(ppInputs);
            module._free(ppOutputs);
            module._free(pOutputCount);
        }
    }
}

async function serializeCloudInputs (
    inputs: Record<string, PlainValue | Value>,
    storage: StorageService,
    minUploadSize: number = 4096
): Promise<Record<string, Value>> {
    // Check
    if (!inputs)
        return null;
    // Serialize
    const key = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); // this doesn't have to be robust
    const entries = await Promise.all(Object.entries(inputs)
        .map(([name, value]) => toFunctionValue({ storage, value, name, minUploadSize, key })
        .then(f => ({ ...f, name })))
    );
    const result = Object.fromEntries(entries.map(({ name, ...value }) => [name, value as Value]));
    // Return
    return result;
}

async function deserializeCloudOutputs (rawResults: Value[], rawOutputs: boolean): Promise<(Value | PlainValue)[]> {
    // Check
    if (!rawResults || rawOutputs)
        return null;
    // Deserialize
    const results = await Promise.all(rawResults.map(value => toPlainValue({ value: value as Value })));
    // Return
    return results;
}

const client = !isBrowser ? !isDeno ? !isNode ? !isWebWorker ?
    "edge" : // e.g. Vercel Serverless Functions with edge runtime
    "webworker" :
    "node" :
    "deno" :
    "browser";
/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { isBrowser, isDeno, isNode, isWebWorker } from "browser-or-node"
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
configuration
resources {
    type
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

export class PredictionService {

    private readonly client: GraphClient;
    private readonly storage: StorageService;
    private readonly cache: Map<string, number>;
    private fxnc: any;
    private readonly FXNC_VERSION = "0.0.11";
    private readonly FXNC_DATA_ROOT = "/fxn";
    private readonly FXNC_CACHE_ROOT = `${this.FXNC_DATA_ROOT}/cache`;

    public constructor (client: GraphClient, storage: StorageService) {
        this.client = client;
        this.storage = storage;
        this.cache = new Map<string, number>();
    }

    /**
     * Create a prediction.
     * @param input Prediction input.
     * @returns Prediction.
     */
    public async create (input: CreatePredictionInput): Promise<Prediction> {
        const { tag, inputs, rawOutputs, dataUrlLimit } = input;
        // Load fxnc
        this.fxnc = this.fxnc ?? await this.loadFxnc();
        // Check if cached
        if (this.cache.has(tag))
            return this.predict(tag, this.cache.get(tag), inputs);
        // Serialize inputs
        const values = await serializeCloudInputs(inputs, this.storage);
        // Build URL
        const url = new URL(`/predict/${tag}`, this.client.url);
        url.searchParams.append("rawOutputs", "true");
        if (dataUrlLimit)
            url.searchParams.append("dataUrlLimit", dataUrlLimit.toString());
        // Query
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": this.client.auth,
                "fxn-client": client,
                "fxn-configuration-token": this.getConfigurationId(),
            },
            body: JSON.stringify(values)
        });        
        const prediction = await response.json();
        // Check
        if (!response.ok)
            throw new Error(prediction.errors?.[0].message ?? "An unknown error occurred");
        // Parse
        prediction.results = await parseResults(prediction.results, rawOutputs);
        // Check edge prediction
        if (prediction.type !== PredictorType.Edge)
            return prediction;
        // Load edge predictor
        const predictor = await this.load(prediction);
        this.cache.set(tag, predictor);
        // Create edge prediction
        return !!inputs ? this.predict(tag, predictor, inputs) : prediction;
    }

    /**
     * Create a streaming prediction.
     * NOTE: This feature is currently experimental.
     * @param input Prediction input.
     * @returns Generator which asynchronously returns prediction results as they are streamed from the predictor.
     */
    public async * stream (input: CreatePredictionInput): AsyncGenerator<Prediction> { // INCOMPLETE // Edge support
        const { tag, inputs, rawOutputs, dataUrlLimit } = input;
        // Load fxnc
        this.fxnc = this.fxnc ?? await this.loadFxnc();
        // Serialize inputs
        const values = await serializeCloudInputs(inputs, this.storage);
        // Request
        const url = new URL(`/predict/${tag}`, this.client.url);
        url.searchParams.append("rawOutputs", "true");
        url.searchParams.append("stream", "true");
        if (dataUrlLimit)
            url.searchParams.append("dataUrlLimit", dataUrlLimit.toString());
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": this.client.auth,
                "fxn-client": client,
                "fxn-configuration-token": this.getConfigurationId(),
            },
            body: JSON.stringify(values)
        });
        // Stream
        const decoder = new TextDecoderStream();
        const reader = response.body.pipeThrough(decoder).getReader();
        let done, value;
        while (!done) {
            // Consume
            ({ value, done } = await reader.read());
            if (done)
                break;
            // Check error
            const payload = JSON.parse(value);
            if (response.status >= 400)
                throw new Error(payload.errors?.[0].message ?? "An unknown error occurred");
            // Deserialize
            payload.results = await parseResults(payload.results, rawOutputs);
            // Yield
            yield payload;
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
        const predictor = this.cache.get(tag);
        this.cache.delete(tag);
        // Release predictor
        const status = this.fxnc._FXNPredictorRelease(predictor);
        return status === 0;
    }

    private async loadFxnc (): Promise<any> {
        // INCOMPLETE // Disable for now
        if (true)
            return null;
        // Check env
        if (!isBrowser)
            return null;
        // Load
        const FXNC_LIB_URL_BASE = `https://cdn.fxn.ai/edgefxn/${this.FXNC_VERSION}`;
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `${FXNC_LIB_URL_BASE}/Function.js`;
            script.onerror = error => reject(`Function Error: Failed to load Function implementation for in-browser predictions with error: ${error}`);
            script.onload = async () => {
                // Get loader
                const name = "__fxn";
                const locateFile = (path: string) => path === "Function.wasm" ? `${FXNC_LIB_URL_BASE}/Function.wasm` : path;
                const moduleLoader = (window as any)[name];
                (window as any)[name] = null;
                try {
                    // Load
                    const fxnc = await moduleLoader({ locateFile });
                    // Mount fs
                    fxnc.FS.mkdir(this.FXNC_DATA_ROOT);
                    //fxnc.FS.mount(fxnc.IDBFS, {}, this.FXNC_DATA_ROOT);
                    await new Promise<void>((res, rej) => fxnc.FS.syncfs(true, (err: any) => err ? rej(err) : res()));
                    // Resolve
                    resolve(fxnc);
                } catch (error) {
                    reject(`Function Error: Failed to load Function implementation for in-browser predictions with error: ${error}`);
                } finally {
                    script.remove();
                }
            };
            document.body.appendChild(script);
        });
    }

    private getConfigurationId (): string {
        const fxnc = this.fxnc;
        if (!fxnc)
            return null;
        const BUFFER_SIZE = 2048;
        const pId = fxnc._malloc(BUFFER_SIZE);
        const status = fxnc._FXNConfigurationGetUniqueID(pId, BUFFER_SIZE);
        const id = status === 0 ? fxnc.UTF8ToString(pId, BUFFER_SIZE) : null;
        fxnc._free(pId);
        cassert(status, `Failed to generate prediction configuration identifier with status: ${status}`);
        return id;
    }

    private async load (prediction: Prediction): Promise<number> { // INCOMPLETE
        const { tag, resources, configuration } = prediction;
        const fxnc = this.fxnc;
        assert(fxnc, `Failed to create ${tag} prediction because Function implementation has not been loaded`);
        assert(configuration, `Failed to create ${tag} prediction because configuration token is missing`);
        const ppConfiguration = fxnc._malloc(4);
        const ppPredictor = fxnc._malloc(4);
        const pTag = fxnc._malloc(tag.length + 1);
        const pToken = fxnc._malloc(configuration.length + 1);
        let pConfiguration = 0;
        try {
            // Create configuration
            let status = fxnc._FXNConfigurationCreate(ppConfiguration);
            cassert(status, `Failed to create ${tag} prediction configuration with status: ${status}`);
            pConfiguration = fxnc.getValue(ppConfiguration, "*");
            // Set tag
            fxnc.stringToUTF8(tag, pTag, tag.length + 1);
            status = fxnc._FXNConfigurationSetTag(pConfiguration, pTag);
            cassert(status, `Failed to set ${tag} prediction configuration tag with status: ${status}`);
            // Set token
            fxnc.stringToUTF8(configuration, pToken, configuration.length + 1);
            status = fxnc._FXNConfigurationSetToken(pConfiguration, pToken);
            cassert(status, `Failed to set ${tag} prediction configuration token with status: ${status}`);
            // Add resources
            fxnc.FS.mkdir(this.FXNC_CACHE_ROOT);
            for (const resource of resources) {
                // Check type
                if (["fxn", "js"].includes(resource.type))
                    continue;
                // Get path
                const name = getResourceName(resource.url);
                const path = `${this.FXNC_CACHE_ROOT}/${name}`;
                const stat = fxnc.FS.analyzePath(path);
                // Download
                if (!stat.exists || true) {
                    const download = await fetch(resource.url);
                    const buffer = await download.arrayBuffer();
                    fxnc.FS.writeFile(path, new Uint8Array(buffer));
                }
                // Add
                const pType = fxnc._malloc(resource.type.length + 1);
                const pPath = fxnc._malloc(path.length + 1);
                fxnc.stringToUTF8(resource.type, pType, resource.type.length + 1);
                fxnc.stringToUTF8(path, pPath, path.length + 1);
                const status = fxnc._FXNConfigurationAddResource(pConfiguration, pType, pPath);
                fxnc._free(pType);
                fxnc._free(pPath);
                cassert(status, `Failed to set ${tag} prediction configuration resource '${name}' with status: ${status}`);
            }
            await new Promise<void>((res, rej) => fxnc.FS.syncfs(false, (err: any) => err ? rej(err) : res()));
            // Create predictor
            status = fxnc._FXNPredictorCreate(pConfiguration, ppPredictor);
            cassert(status, `Failed to create prediction for ${tag} with status: ${status}`);   
            // Get predictor
            const predictor = fxnc.getValue(ppPredictor, "*");
            // Return
            return predictor;
        } finally {
            fxnc._FXNConfigurationRelease(pConfiguration);
            fxnc._free(ppConfiguration);
            fxnc._free(ppPredictor);
            fxnc._free(pTag);
            fxnc._free(pToken);
        }
    }

    private async predict (
        tag: string,
        predictor: number,
        inputs: Record<string, Value | PlainValue>
    ): Promise<Prediction> {
        const ID_BUFFER_SIZE = 2048;
        const ERROR_BUFFER_SIZE = 2048;
        const VALUE_NAME_BUFFER_SIZE = 256;
        const fxnc = this.fxnc;
        const ppPrediction = fxnc._malloc(4);
        const ppInputs = fxnc._malloc(4);
        const ppOutputs = fxnc._malloc(4);
        const pOutputCount = fxnc._malloc(4);
        const pId = fxnc._malloc(ID_BUFFER_SIZE);
        const pError = fxnc._malloc(ERROR_BUFFER_SIZE);
        const pLatency = fxnc._malloc(8);
        const pLogLength = fxnc._malloc(4);
        let pInputs = 0;
        let pPrediction = 0;
        try {
            // Create input map
            let status = fxnc._FXNValueMapCreate(ppInputs);
            cassert(status, `Failed to create ${tag} prediction because input value map could not be created with status: ${status}`);
            // Marshal inputs
            pInputs = fxnc.getValue(ppInputs, "*");
            for (const [key, value] of Object.entries(inputs)) {
                const pValue = valueToEdgeValue(value, module);
                const pKey = fxnc._malloc(key.length + 1);
                fxnc.stringToUTF8(key, pKey, key.length + 1);
                status = fxnc._FXNValueMapSetValue(pInputs, pKey, pValue);
                cassert(status, `Failed to create ${tag} prediction because input value '${key}' could not be created with status: ${status}`);
                fxnc._free(pKey);
            }
            // Make prediction
            status = fxnc._FXNPredictorPredict(predictor, pInputs, ppPrediction);
            cassert(status, `Failed to create ${tag} prediction with status: ${status}`);
            pPrediction = fxnc.getValue(ppPrediction, "*");
            // Get ID
            status = fxnc._FXNPredictionGetID(pPrediction, pId, ID_BUFFER_SIZE);
            cassert(status, `Failed to retrieve ${tag} prediction identifier with status: ${status}`);
            const id = fxnc.UTF8ToString(pId, ID_BUFFER_SIZE);
            // Get error
            status = fxnc._FXNPredictionGetError(pPrediction, pError, ERROR_BUFFER_SIZE);
            const error = status == 0 ? fxnc.UTF8ToString(pError, ERROR_BUFFER_SIZE) : null;
            // Get latency
            status = fxnc._FXNPredictionGetLatency(pPrediction, pLatency);
            cassert(status, `Failed to retrieve ${tag} prediction latency with status: ${status}`);
            const latency = fxnc.getValue(pLatency, "double");
            // Get logs
            status = fxnc._FXNPredictionGetLogLength(pPrediction, pLogLength);
            cassert(status, `Failed to retrieve ${tag} prediction log length with status: ${status}`);
            const logLength = fxnc.getValue(pLogLength, "i32") + 1;
            const pLogs = fxnc._malloc(logLength);
            status = fxnc._FXNPredictionGetLogs(pPrediction, pLogs, logLength);
            const logs = status == 0 ? fxnc.UTF8ToString(pLogs, logLength) : null;
            fxnc._free(pLogs);
            // Marshal outputs
            status = fxnc._FXNPredictionGetResults(pPrediction, ppOutputs);
            cassert(status, `Failed to retrieve ${tag} prediction results with status: ${status}`);
            const pOutputs = fxnc.getValue(ppOutputs, "*");
            status = fxnc._FXNValueMapGetSize(pOutputs, pOutputCount);
            cassert(status, `Failed to retrieve ${tag} prediction result count with status: ${status}`);
            const outputCount = fxnc.getValue(pOutputCount, "i32");
            const results: PlainValue[] = outputCount > 0 ? [] : null;
            for (let idx = 0; idx < outputCount; idx++) {
                // Get name
                const pName = fxnc._malloc(VALUE_NAME_BUFFER_SIZE);
                fxnc._FXNValueMapGetKey(pOutputs, idx, pName, VALUE_NAME_BUFFER_SIZE);
                // Get value
                const ppValue = fxnc._malloc(4);
                fxnc._FXNValueMapGetValue(pOutputs, pName, ppValue);
                const pValue = fxnc.getValue(ppValue, "*");
                const value = edgeToPlainValue(pValue, module);
                // Append
                results.push(value);
                fxnc._free(pName);
                fxnc._free(ppValue);
            }
            // Return
            return {
                id,
                tag,
                type: PredictorType.Edge,
                created: new Date().toISOString() as unknown as Date,
                results,
                latency,
                error,
                logs
            };
        } finally {
            fxnc._FXNValueMapRelease(pInputs);
            fxnc._FXNPredictionRelease(pPrediction);
            fxnc._free(ppPrediction);
            fxnc._free(ppInputs);
            fxnc._free(ppOutputs);
            fxnc._free(pOutputCount);
            fxnc._free(pId);
            fxnc._free(pError);
            fxnc._free(pLatency);
            fxnc._free(pLogLength);
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

async function parseResults (rawResults: Value[], rawOutputs: boolean): Promise<(Value | PlainValue)[]> {
    return rawResults && !rawOutputs ? 
        await Promise.all(rawResults.map(value => toPlainValue({ value: value as Value }))) :
        rawResults;
}

function generateUniqueId () {
    const buffer = new Uint8Array(16);
    crypto.getRandomValues(buffer);
    const uid = Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join('');
    return uid;
}

/*
function getConfigurationId () {
    // Browser
    if (typeof window !== "undefined") {
        const currentId = localStorage.getItem("__edgefxn");
        if (currentId)
            return currentId;
        const newId = generateUniqueId();
        localStorage.setItem("__edgefxn", newId);
        return newId;
    }
}
*/

function getResourceName (url: string): string {
    return new URL(url).pathname.split("/").pop();
}

function sanitizeTag (tag: string): string {
    return tag.substring(1).replace("-", "_").replace("/", "_");
}

function assert (condition: any, message: string) {
    if (!condition)
        throw new Error(`Function Error: ${message ?? "An unknown error occurred"}`);
}

function cassert (condition: number, message: string) {
    assert(condition === 0, message);        
}

const client = !isBrowser ? !isDeno ? !isNode ? !isWebWorker ?
    "edge" : // e.g. Vercel Serverless Functions with edge runtime
    "webworker" :
    "node" :
    "deno" :
    "browser";
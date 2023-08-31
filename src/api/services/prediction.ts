/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import { isBrowser, isDeno, isNode, isWebWorker } from "browser-or-node"
import { GraphClient } from "../graph"
import { CloudPrediction, PlainValue, Value } from "../types"
import { toFunctionValue, toPlainValue } from "./value"
import { StorageService } from "./storage"

export const PREDICTION_FIELDS = `
id
tag
type
created
... on CloudPrediction {
    results {
        data
        type
        shape
    }
    latency
    error
    logs
}
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

export class PredictionService {

    private readonly client: GraphClient;
    private readonly storage: StorageService;

    public constructor (client: GraphClient, storage: StorageService) {
        this.client = client;
        this.storage = storage;
    }

    /**
     * Create a prediction.
     * @param input Prediction input.
     * @returns Prediction.
     */
    public async create (input: CreatePredictionInput): Promise<CloudPrediction> {
        const { tag, inputs: rawInputs, rawOutputs, dataUrlLimit } = input;
        // Serialize inputs
        const inputObject = await serializePredictionInputs(rawInputs, this.storage);
        const inputs = inputObject ? Object.entries(inputObject).map(([name, value]) => ({ ...value, name })) : null;
        // Query
        const { data: { prediction } } = await this.client.query<{ prediction: CloudPrediction }>(
            `mutation ($input: CreatePredictionInput!) {
                prediction: createPrediction (input: $input) {
                    ${PREDICTION_FIELDS}
                }
            }`,
            { input: { tag, inputs, client, dataUrlLimit } }
        );
        // Parse
        const result = await deserializePredictionOutputs(prediction, rawOutputs);
        // Return
        return result;
    }

    /**
     * Create a streaming prediction.
     * NOTE: This feature is currently experimental.
     * @param input Prediction input.
     * @returns Generator which asynchronously returns prediction results as they are streamed from the predictor.
     */
    public async * stream (input: CreatePredictionInput): AsyncGenerator<CloudPrediction> {
        const { tag, inputs: rawInputs, rawOutputs, dataUrlLimit } = input;
        // Serialize inputs
        const inputs = await serializePredictionInputs(rawInputs, this.storage);
        // Request
        const url = new URL(`/predict/${tag}`, this.client.url.origin);
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
            const payload = JSON.parse(value) as CloudPrediction;
            if (response.status >= 400)
                throw new Error(payload.error);
            const prediction = await deserializePredictionOutputs(payload, rawOutputs);        
            yield prediction;
        }
    }
}

async function serializePredictionInputs (
    inputs: Record<string, PlainValue | Value>,
    storage: StorageService,
    minUploadSize: number = 4096
): Promise<Record<string, Value>> {
    if (!inputs)
        return null;
    const key = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); // this doesn't have to be robust
    const entries = await Promise.all(Object.entries(inputs)
        .map(([name, value]) => toFunctionValue({ storage, value, name, minUploadSize, key })
        .then(f => ({ ...f, name })))
    );
    const result = Object.fromEntries(entries.map(({ name, ...value }) => [name, value as Value]));
    return result;
}

async function deserializePredictionOutputs (
    prediction: CloudPrediction,
    rawOutputs: boolean
): Promise<CloudPrediction> {
    const  { results: rawResults, ...others } = prediction;
    const results = rawResults && !rawOutputs ?
        await Promise.all(rawResults.map(value => toPlainValue({ value: value as Value }))) :
        rawResults;
    return rawResults !== undefined ? { ...others, results } : others;
}

const client = !isBrowser ? !isDeno ? !isNode ? !isWebWorker ?
    "edge" : // we get this in e.g. Vercel Serverless Functions with edge runtime
    "webworker" :
    "node" :
    "deno" :
    "browser";
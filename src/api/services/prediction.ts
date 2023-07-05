/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import { isBrowser, isDeno, isNode, isWebWorker } from "browser-or-node"
import { GraphClient } from "../graph"
import { CloudPrediction, EdgePrediction, PlainValue, Value } from "../types"
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
    inputs?: { [key: string]: PlainValue | Value };
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
     * @param input Input arguments.
     * @returns Prediction.
     */
    public async create (input: CreatePredictionInput): Promise<CloudPrediction | EdgePrediction> {
        const { tag, inputs: rawInputs, rawOutputs, dataUrlLimit } = input;
        const minUploadSize = 4096;
        const key = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); // this doesn't have to be good
        const inputs = rawInputs ?
            await Promise.all(Object.entries(rawInputs)
                .map(([name, value]) => toFunctionValue({ storage: this.storage, value, name, minUploadSize, key })
                .then(f => ({ ...f, name })))
            ) : null;
        const { data: { prediction: { results: rawResults, ...others } } } = await this.client.query<{ prediction: CloudPrediction & EdgePrediction }>(
            `mutation ($input: CreatePredictionInput!) {
                prediction: createPrediction (input: $input) {
                    ${PREDICTION_FIELDS}
                }
            }`,
            { input: { tag, inputs, client, dataUrlLimit } }
        );
        const results = rawResults && !rawOutputs ?
            await Promise.all(rawResults.map(value => toPlainValue({ value: value as Value }))) :
            rawResults;
        const prediction = rawResults !== undefined ? { ...others, results } : others;
        return prediction;
    }
}

const client = !isBrowser ? !isDeno ? !isNode ? !isWebWorker ? "unknown" : "webworker" : "node" : "deno" : "browser";
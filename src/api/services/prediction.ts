/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import { isBrowser, isDeno, isNode, isWebWorker } from "browser-or-node"
import { GraphClient } from "../graph"
import { CloudPrediction, EdgePrediction, Feature, FeatureValue, Prediction } from "../types"

export type ParameterInput =  { [key: string]: FeatureValue };

/**
 * We hide this from devs.
 */
interface OutputFeature extends Feature {
    /**
     * Feature data as a `string`.
     * This is a convenience property and is only populated for `string` features.
     */
    stringValue?: string;
    /**
     * Feature data as a `float`.
     * This is a convenience property and is only populated for `float32` or `float64` scalar features.
     */
    floatValue?: number;
    /**
     * Feature data as a flattened `float` array.
     * This is a convenience property and is only populated for `float32` tensor features.
     */
    floatArray?: number[];
    /**
     * Feature data as an integer.
     * This is a convenience property and is only populated for integer scalar features.
    */
    intValue?: number;
    /**
     * Feature data as a flattened `int32` array.
     * This is a convenience property and is only populated for `int32` tensor features.
    */
    intArray?: number[];
    /**
     * Feature data as a boolean.
     * This is a convenience property and is only populated for `bool` scalar features.
    */
    boolValue?: boolean;
    /**
     * Feature data as a flattened boolean array.
     * This is a convenience property and is only populated for `bool` tensor features.
     */
    boolArray?: boolean[];
    /**
     * Feature data as a list.
     * This is a convenience property and is only populated for `list` features.
     */
    listValue?: any[];
    /**
     * Feature data as a dictionary.
     * This is a convenience property and is only populated for `dict` features.
     */
    dictValue: { [key: string]: any };
}

export interface FeatureInput extends Partial<OutputFeature> {
    /**
     * Feature name.
     */
    name: string;
}

export interface CreatePredictionInput {
    /**
     * Predictor tag.
     */
    tag: string;
    /**
     * Input features.
     * This is mutually exclusive with `features`.
     */
    inputs?: ParameterInput;
    /**
     * Input features.
     * This is mutually exclusive with `inputs`.
     */
    features?: FeatureInput[];
    /**
     * Do not populate convenience fields in output features.
     * This defaults to `false`.
     */
    rawOutputs?: boolean;
    /**
     * Return a data URL if the output feature is smaller than this limit (in bytes).
     */
    dataUrlLimit?: number;
}

export class PredictionService {

    private readonly client: GraphClient;

    public constructor (client: GraphClient) {
        this.client = client;
    }

    /**
     * Create a prediction.
     * @param input Input arguments.
     * @returns Prediction.
     */
    public async create (input: CreatePredictionInput): Promise<CloudPrediction | EdgePrediction> {
        const { tag, inputs: rawInputs, features, rawOutputs, dataUrlLimit } = input;
        const inputs = rawInputs ? Object.entries(rawInputs).map(([name, value]) => createInputFeature(name, value)) : features;
        const extraFields = rawOutputs ? "" : "stringValue floatValue floatArray intValue intArray boolValue boolArray listValue dictValue";
        const { data: { prediction: { results: rawResults, ...prediction } } } = await this.client.query<{ prediction: Omit<Prediction, "results"> & { results?: OutputFeature[] } }>(
            `mutation ($input: CreatePredictionInput!) {
                prediction: createPrediction (input: $input) {
                    id
                    tag
                    created
                    results {
                        data
                        type
                        shape
                        ${extraFields}
                    }
                    latency
                    error
                    logs
                }
            }`,
            { input: { tag, inputs, client, dataUrlLimit } }
        );
        const results = rawResults?.map(({ data, type, shape, stringValue, floatValue, floatArray, intValue, intArray, boolValue, boolArray, listValue, dictValue }) => {
            return stringValue ?? floatValue ?? floatArray ?? intValue ?? intArray ?? boolValue ?? boolArray ?? listValue ?? dictValue ?? { data, type, shape };
        });
        return { ...prediction, results };
    }
}

function createInputFeature (name: string, value: FeatureValue): FeatureInput {
    switch (typeof value) {
        case "string":  return { name, stringValue: value };
        case "number":  return Number.isInteger(value) ? { name, floatValue: value } : { name, intValue: value };
        case "boolean": return { name, boolValue: value };
        case "object":  return { name, dictValue: value };
        default:        throw new Error(`Cannot create input feature from value of type '${typeof value}'`);
    }
}

const client = !isBrowser ? !isDeno ? !isNode ? !isWebWorker ? "unknown" : "webworker" : "node" : "deno" : "browser";
/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { GraphClient } from "../api"
import { getFxnc, type FXNC } from "../c"
import { BoolArray, isImage, isTensor } from "../types"
import type { Acceleration, Prediction, TypedArray, Value } from "../types"

export const PREDICTION_FIELDS = `
id
tag
created
configuration
resources {
    type
    url
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
    inputs?: Record<string, Value>;
    /**
     * Prediction acceleration.
     */
    acceleration?: Acceleration;
    /**
     * Function client identifier.
     * Specify this to override the current client identifier.
     */
    clientId?: string;
    /**
     * Configuration identifier.
     * Specify this to override the current client configuration identifier.
     */
    configurationId?: string;
}

export interface DeletePredictionInput {
    /**
     * Predictor tag.
     */
    tag: string;
}

export class PredictionService {

    private readonly client: GraphClient;
    private readonly cache: Map<string, FXNPredictor>;

    public constructor (client: GraphClient) {
        this.client = client;
        this.cache = new Map<string, FXNPredictor>();
    }

    /**
     * Create a prediction.
     * @param input Prediction input.
     * @returns Prediction.
     */
    public async create (input: CreatePredictionInput): Promise<Prediction> {
        const { tag, inputs } = input;
        // Check for raw prediction
        if (!inputs)
            return this.createRawPrediction(input);
        // Predict
        const predictor = await this.getPredictor(input);
        const prediction = this.predict(tag, predictor, inputs);
        // Return
        return prediction;
    }

    /**
     * Create a streaming prediction.
     * NOTE: This feature is currently experimental.
     * @param input Prediction input.
     * @returns Generator which asynchronously returns prediction results as they are streamed from the predictor.
     */
    public async * stream (input: CreatePredictionInput): AsyncGenerator<Prediction> { // INCOMPLETE // Streaming support
        // Check inputs
        const { tag, inputs } = input;
        assert(!!inputs, `Failed to stream ${tag} prediction because prediction inputs were not provided`);
        // Predict
        const predictor = await this.getPredictor(input);
        const prediction = this.predict(tag, predictor, inputs);
        // Yield single prediction
        yield prediction;
    }

    /**
     * Delete a predictor that is loaded in memory.
     * @param input Input arguments.
     * @returns Whether the predictor was successfully deleted from memory.
     */
    public async delete (input: DeletePredictionInput): Promise<boolean> {
        const { tag } = input;
        // Check
        if (!this.cache.has(tag))
            return false;
        // Release
        const predictor = this.cache.get(tag);
        this.cache.delete(tag);
        predictor.dispose();
        // Throws on failure
        return true;
    }

    private async createRawPrediction (input: CreatePredictionInput): Promise<Prediction> {
        const fxnc = await getFxnc();
        const {
            tag,
            clientId = fxnc?.FXNConfiguration.getClientId() ?? "node",
            configurationId = fxnc?.FXNConfiguration.getUniqueId()
        } = input;
        // Query
        const url = `${this.client.url}/predict/${tag}`;
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "Authorization": this.client.auth,
            "fxn-client": clientId,
        };
        if (configurationId != null)
            headers["fxn-configuration-token"] = configurationId;
        const response = await fetch(url, { method: "POST", headers, body: "{}" });        
        let prediction = await response.json();
        // Check
        if (!response.ok)
            throw new Error(prediction.errors?.[0].message ?? "An unknown error occurred");
        // Return
        return prediction;
    }

    private async getPredictor (input: CreatePredictionInput): Promise<FXNPredictor> {
        // Check fxnc
        const { tag, acceleration } = input;
        const fxnc = await getFxnc();
        assert(fxnc, `Failed to create ${tag} prediction because Function implementation has not been loaded`);
        // Check cache
        if (this.cache.has(tag))
            return this.cache.get(tag);
        // Create prediction
        const prediction = await this.createRawPrediction(input);
        assert(prediction.configuration, `Failed to create ${tag} prediction because configuration token is missing`);
        // Load predictor
        let configuration: FXNConfiguration;
        try {
            configuration = fxnc.FXNConfiguration.create();
            configuration.tag = tag;
            configuration.token = prediction.configuration;
            configuration.acceleration = acceleration;
            for (const resource of prediction.resources)
                if (["dso", "bin"].includes(resource.type))
                    await configuration.addResource(resource);
            const predictor = fxnc.FXNPredictor.create(configuration);
            this.cache.set(tag, predictor);
            return predictor;
        } finally {
            configuration?.dispose();
        }   
    }

    private async predict (
        tag: string,
        predictor: FXNPredictor,
        inputs: Record<string, Value>
    ): Promise<Prediction> {
        const fxnc = await getFxnc();
        let inputMap: FXNValueMap;
        let prediction: FXNPrediction;
        try {
            inputMap = fxnc.FXNValueMap.create();
            for (const [key, value] of Object.entries(inputs))
                inputMap.set(key, this.toValue(value, fxnc));
            prediction = predictor.createPrediction(inputMap);
            const { id, results: outputMap, latency, error, logs } = prediction;
            const results = outputMap ? Array.from(
                { length: outputMap.size },
                (_, idx) => outputMap.get(outputMap.key(idx)).toObject()
            ) : null;
            const created = new Date().toISOString() as unknown as Date;
            return { id, tag, created, results, latency, error, logs };
        } finally {
            inputMap?.dispose();
            prediction?.dispose();
        }
    }
    
    private toValue (value: Value, fxnc: FXNC): FXNValue {
        const { FXNValue } = fxnc;
        // Null
        if (value == null)
            return FXNValue.createNull();
        // Tensor
        if (isTensor(value))
            return FXNValue.createArray(value.data, value.shape, 0);
        // Typed array
        if (ArrayBuffer.isView(value))
            return FXNValue.createArray(
                value as any,
                [value.byteLength / (value.constructor as unknown as TypedArray).BYTES_PER_ELEMENT],
                0
            );
        // Binary
        if (value instanceof ArrayBuffer)
            return FXNValue.createBinary(value, 0);
        // String
        if (typeof(value) === "string")
            return FXNValue.createString(value);
        // Number
        if (typeof(value) === "number")
            return FXNValue.createArray(
                Number.isInteger(value) ? new Int32Array([value]) : new Float32Array([value]),
                null,
                1
            );
        // Bigint
        if (typeof(value) === "bigint")
            return FXNValue.createArray(new BigInt64Array([value]), null, 1);
        // Boolean
        if (typeof(value) === "boolean")
            return FXNValue.createArray(new BoolArray([value]), null, 1);
        // Image
        if (isImage(value))
            return FXNValue.createImage(value, 0);
        // List
        if (Array.isArray(value))
            return FXNValue.createList(value);
        // Dict
        if (typeof(value) === "object")
            return FXNValue.createDict(value);
        throw new Error(`Failed to create prediction input value for unsupported type: ${typeof(value)}`);
    }
}

function assert (condition: any, message: string) {
    if (!condition)
        throw new Error(message ?? "An unknown error occurred");
}
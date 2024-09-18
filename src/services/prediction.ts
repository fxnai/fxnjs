/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { getFxnc, type FXNC } from "../c"
import type { FunctionClient } from "../client"
import { BoolArray, isImage, isTensor } from "../types"
import type { Acceleration, Prediction, TypedArray, Value } from "../types"

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

    private readonly client: FunctionClient;
    private readonly cache: Map<string, FXNPredictor>;
    private fxnc: FXNC;

    public constructor (client: FunctionClient) {
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
        let inputMap: FXNValueMap;
        let prediction: FXNPrediction;
        try {
            inputMap = this.toValueMap(inputs);
            prediction = predictor.createPrediction(inputMap);
            return this.toPrediction(tag, prediction);
        } finally {
            inputMap?.dispose();
            prediction?.dispose();
        }
    }

    /**
     * Create a streaming prediction.
     * NOTE: This feature is currently experimental.
     * @param input Prediction input.
     * @returns Generator which asynchronously returns prediction results as they are streamed from the predictor.
     */
    public async * stream (input: CreatePredictionInput): AsyncGenerator<Prediction> {
        // Check inputs
        const { tag, inputs } = input;
        assert(!!inputs, `Failed to stream ${tag} prediction because prediction inputs were not provided`);
        // Predict
        const predictor = await this.getPredictor(input);
        let inputMap: FXNValueMap;
        let stream: FXNPredictionStream;
        try {
            inputMap = this.toValueMap(inputs);
            stream = predictor.streamPrediction(inputMap);
            while (true) {
                const prediction = stream.readNext();
                if (!prediction)
                    break;
                yield this.toPrediction(tag, prediction);
                prediction.dispose();
            }
        } finally {
            inputMap?.dispose();
            stream?.dispose();
        }
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
        this.fxnc ??= await getFxnc();
        const {
            tag,
            clientId = this.fxnc?.FXNConfiguration.getClientId() ?? "node",
            configurationId = this.fxnc?.FXNConfiguration.getUniqueId()
        } = input;
        const prediction = await this.client.request<Prediction>({
            path: "/predictions",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: { tag, clientId, configurationId }
        })
        return prediction;
    }

    private async getPredictor (input: CreatePredictionInput): Promise<FXNPredictor> {
        const { tag, acceleration } = input;
        // Check cache
        if (this.cache.has(tag))
            return this.cache.get(tag);
        // Load fxnc
        this.fxnc ??= await getFxnc();
        assert(this.fxnc, `Failed to create ${tag} prediction because Function implementation has not been loaded`);
        const { FXNConfiguration, FXNPredictor } = this.fxnc;
        // Create prediction
        const prediction = await this.createRawPrediction(input);
        assert(prediction.configuration, `Failed to create ${tag} prediction because configuration token is missing`);
        // Load predictor
        let configuration: FXNConfiguration;
        try {
            configuration = FXNConfiguration.create();
            configuration.tag = tag;
            configuration.token = prediction.configuration;
            configuration.acceleration = acceleration ?? 0;
            for (const resource of prediction.resources)
                await configuration.addResource(resource);
            const predictor = FXNPredictor.create(configuration);
            this.cache.set(tag, predictor);
            return predictor;
        } finally {
            configuration?.dispose();
        }   
    }
    
    private toValue (value: Value): FXNValue {
        const { FXNValue } = this.fxnc;
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

    private toValueMap (inputs: Record<string, Value>): FXNValueMap {
        const { FXNValueMap } = this.fxnc;
        const map = FXNValueMap.create();
        for (const [key, value] of Object.entries(inputs))
            map.set(key, this.toValue(value));
        return map;
    }

    private toPrediction (tag: string, prediction: FXNPrediction): Prediction {
        const { id, results: outputMap, latency, error, logs } = prediction;
        const results = outputMap ? Array.from(
            { length: outputMap.size },
            (_, idx) => outputMap.get(outputMap.key(idx)).toObject()
        ) : null;
        const created = new Date().toISOString() as unknown as Date;
        return { id, tag, created, results, latency, error, logs };
    }
}

function assert (condition: any, message: string) {
    if (!condition)
        throw new Error(message ?? "An unknown error occurred");
}
/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import parseDataURL from "data-urls"
import { GraphClient } from "../api"
import { getFxnc, type FXNC } from "../c"
import type { BoolArray, Dtype, Image, PlainValue, Prediction, Tensor, TypedArray, Value } from "../types"
import { isFunctionValue, isImage, isTensor, isTypedArray } from "./value"
import { StorageService } from "./storage"

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
    /**
     * Function client identifier.
     * Specify this to override the current client identifier.
     */
    client?: string;
    /**
     * Configuration identifier.
     * Specify this to override the current client configuration identifier.
     */
    configuration?: string;
}

export interface DeletePredictionInput {
    /**
     * Predictor tag.
     */
    tag: string;
}

export interface ToValueInput {
    /**
     * Input value.
     */
    value: Value | PlainValue;
    /**
     * Value name.
     */
    name: string;
    /**
     * Value larger than this size in bytes will be uploaded.
     */
    minUploadSize?: number;
    key?: string;
}

export interface ToObjectInput {
    /**
     * Function value.
     */
    value: Value;
}

export class PredictionService {

    private readonly client: GraphClient;
    private readonly storage: StorageService;
    private readonly cache: Map<string, FXNPredictor>;

    public constructor (client: GraphClient, storage: StorageService) {
        this.client = client;
        this.storage = storage;
        this.cache = new Map<string, FXNPredictor>();
    }

    /**
     * Create a prediction.
     * @param input Prediction input.
     * @returns Prediction.
     */
    public async create (input: CreatePredictionInput): Promise<Prediction> {
        // Check if cached
        const fxnc = await getFxnc();
        const {
            tag,
            inputs,
            rawOutputs,
            dataUrlLimit,
            client = fxnc?.FXNConfiguration.getClientId() ?? "node",
            configuration = fxnc?.FXNConfiguration.getUniqueId() ?? null
        } = input;
        if (this.cache.has(tag) && !rawOutputs)
            return this.predict(tag, await this.cache.get(tag), inputs);
        // Serialize inputs
        const values = await this.serializeCloudInputs(inputs, dataUrlLimit);        
        // Query
        const url = this.getPredictUrl(tag, { rawOutputs: true, dataUrlLimit });
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": this.client.auth,
                "fxn-client": client,
                "fxn-configuration-token": configuration,
            },
            body: JSON.stringify(values)
        });        
        const prediction = await response.json();
        // Check
        if (!response.ok)
            throw new Error(prediction.errors?.[0].message ?? "An unknown error occurred");
        // Parse
        prediction.results = await this.parseResults(prediction.results, rawOutputs);
        if (prediction.type === "EDGE" && !rawOutputs) {
            this.cache.set(tag, await this.load(prediction));
            return !!inputs ? this.predict(tag, this.cache.get(tag), inputs) : prediction;
        } else
            return prediction;
    }

    /**
     * Create a streaming prediction.
     * NOTE: This feature is currently experimental.
     * @param input Prediction input.
     * @returns Generator which asynchronously returns prediction results as they are streamed from the predictor.
     */
    public async * stream (input: CreatePredictionInput): AsyncGenerator<Prediction> {
        // Check if cached
        const fxnc = await getFxnc();
        const {
            tag,
            inputs,
            rawOutputs,
            dataUrlLimit,
            client = fxnc?.FXNConfiguration.getClientId() ?? "node",
            configuration = fxnc?.FXNConfiguration.getUniqueId() ?? null
        } = input;
        if (this.cache.has(tag) && !rawOutputs) {
            yield this.predict(tag, await this.cache.get(tag), inputs);
            return;
        }
        // Serialize inputs
        const values = await this.serializeCloudInputs(inputs, dataUrlLimit);
        // Request
        const url = this.getPredictUrl(tag, { stream: true, rawOutputs: true, dataUrlLimit });
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": this.client.auth,
                "fxn-client": client,
                "fxn-configuration-token": configuration,
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
            const prediction = JSON.parse(value);
            if (response.status >= 400)
                throw new Error(prediction.errors?.[0].message ?? "An unknown error occurred");
            // Parse
            prediction.results = await this.parseResults(prediction.results, rawOutputs);
            if (prediction.type === "EDGE" && !rawOutputs) {
                this.cache.set(tag, await this.load(prediction));
                yield !!inputs ? this.predict(tag, this.cache.get(tag), inputs) : prediction;
            } else
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
        const predictor = this.cache.get(tag);
        this.cache.delete(tag);
        // Release predictor
        predictor.dispose();
        return true;
    }

    /**
     * Convert an object into a Function value.
     * @param input Input arguments.
     * @returns Function value.
     */
    public async toValue (input: ToValueInput): Promise<Value> {
        const { value, name, minUploadSize: dataUrlLimit = 4096, key } = input;
        // Null
        if (value === null)
            return { data: null, type: "null" };
        // Value
        if (isFunctionValue(value))
            return value;
        // Tensor
        if (isTensor(value)) {
            const data = await this.storage.upload({ name, buffer: value.data.buffer, type: "VALUE", dataUrlLimit, key });
            const type = getTypedArrayDtype(value.data);
            return { data, type, shape: value.shape };
        }
        // Image
        if (isImage(value)) { // CHECK // NodeJS
            const fxnc = await getFxnc();
            assert(fxnc, "Failed to convert image to value because Function implementation has not been loaded");
            let imageValue: FXNValue = null;
            let encodedValue: FXNValue = null;
            try {
                imageValue = fxnc.FXNValue.createImage(value, 0);
                encodedValue = fxnc.FXNValue.createBySerializingValue(imageValue, 0);
                const buffer = encodedValue.toObject() as ArrayBuffer;
                const data = await this.storage.upload({ name, buffer, type: "VALUE", dataUrlLimit, key });
                return { data, type: "image" };
            } finally {
                imageValue?.dispose();
                encodedValue?.dispose();
            }
        }
        // Typed array
        if (isTypedArray(value))
            return await this.toValue({ ...input, value: { data: value, shape: [value.length] } });
        // Binary
        if (value instanceof ArrayBuffer) {
            const data = await this.storage.upload({ name, buffer: value, type: "VALUE", dataUrlLimit, key });
            return { data, type: "binary" };
        }
        // String
        if (typeof(value) === "string") {
            const buffer = new TextEncoder().encode(value).buffer;
            const data = await this.storage.upload({ name, buffer, type: "VALUE", dataUrlLimit, key });
            return { data, type: "string" };
        }
        // Number
        if (typeof(value) === "number") {
            const isInt = Number.isInteger(value);
            const buffer = isInt ? new Int32Array([ value as number ]).buffer : new Float32Array([ value as number ]).buffer;
            const data = await this.storage.upload({ name, buffer, type: "VALUE", dataUrlLimit, key });
            const type = isInt ? "int32" : "float32";
            return { data, type, shape: [] };
        }
        // Boolean
        if (typeof(value) === "boolean") {
            const buffer = new Uint8Array([ +value ]).buffer;
            const data = await this.storage.upload({ name, buffer, type: "VALUE", dataUrlLimit, key });
            return { data, type: "bool", shape: [] };
        }
        // Boolean array // We want benefits of `TypedArray` given that there's no `BoolArray`
        if (
            Array.isArray(value) &&
            value.length > 0 &&
            typeof(value[0]) === "boolean" &&
            !value.some(e => typeof(e) !== "boolean") // fail faster for non-boolean arrays
        ) {
            const buffer = new Uint8Array(value as number[]).buffer;
            const data = await this.storage.upload({ name, buffer, type: "VALUE", dataUrlLimit, key });
            return { data, type: "bool", shape: [value.length] };
        }
        // List
        if (Array.isArray(value)) {
            const serializedValue = JSON.stringify(value);
            const buffer = new TextEncoder().encode(serializedValue).buffer;
            const data = await this.storage.upload({ name, buffer, type: "VALUE", dataUrlLimit, key });
            return { data, type: "list" };
        }
        // Dict
        if (typeof(value) === "object") {
            const serializedValue = JSON.stringify(value);
            const buffer = new TextEncoder().encode(serializedValue).buffer;
            const data = await this.storage.upload({ name, buffer, type: "VALUE", dataUrlLimit, key });
            return { data, type: "dict" };
        }
        // Throw
        throw new Error(`Value ${value} of type ${typeof(value)} cannot be converted to a Function value`);
    }

    /**
     * Convert a Function value to a plain object.
     * If the Function value cannot be converted to a plain object, the Function value is returned as-is.
     * @param input Input arguments.
     * @returns Plain object.
     */
    public async toObject (input: ToObjectInput): Promise<PlainValue | Value> {
        const { value: { data, type, shape } } = input;
        const fxnc = await getFxnc();
        const buffer = await getValueData(data);
        switch (type) {
            case "null":    return null;
            case "float16":
            case "float32":
            case "float64":
            case "int8":
            case "int16":
            case "int32":
            case "int64":
            case "uint8":
            case "uint16":
            case "uint32":
            case "uint64":
            case "bool":    return toTensorOrNumber(buffer, type, shape);
            case "string":  return new TextDecoder().decode(buffer);
            case "list":
            case "dict":    return JSON.parse(new TextDecoder().decode(buffer));
            case "image":   return toImage(buffer, fxnc);
            case "binary":  return buffer;
            default:        return input.value;
        }
    }

    private async load (prediction: Prediction): Promise<FXNPredictor> {
        const { tag, resources, configuration: token } = prediction;
        const fxnc = await getFxnc();
        assert(fxnc, `Failed to create ${tag} prediction because Function implementation has not been loaded`);
        assert(token, `Failed to create ${tag} prediction because configuration token is missing`);
        let configuration: FXNConfiguration;
        try {
            configuration = fxnc.FXNConfiguration.create();
            configuration.tag = tag;
            configuration.token = token;
            for (const resource of resources)
                if (["dso", "bin"].includes(resource.type))
                    await configuration.addResource(resource);
            const predictor = fxnc.FXNPredictor.create(configuration);
            return predictor;
        } finally {
            configuration?.dispose();
        }
    }

    private async predict (
        tag: string,
        predictor: FXNPredictor,
        inputs: Record<string, Value | PlainValue>
    ): Promise<Prediction> {
        const fxnc = await getFxnc();
        let inputMap: FXNValueMap;
        let prediction: FXNPrediction;
        try {
            inputMap = fxnc.FXNValueMap.create();
            for (const [key, value] of Object.entries(inputs))
                inputMap.set(key, this.toEdgeValue(value, fxnc));
            prediction = predictor.createPrediction(inputMap);
            const { results: outputMap, latency, error, logs } = prediction;
            const results = outputMap ? Array.from(
                { length: outputMap.size },
                (_, idx) => outputMap.get(outputMap.key(idx)).toObject()
            ) : null;
            return {
                id: prediction.id,
                tag,
                type: "EDGE",
                created: new Date().toISOString() as unknown as Date,
                results,
                latency,
                error,
                logs
            };
        } finally {
            inputMap.dispose();
            prediction.dispose();
        }
    }
    
    private toEdgeValue (value: PlainValue | Value, fxnc: FXNC): FXNValue {
        const { FXNValue } = fxnc;
        // Null
        if (value == null)
            return FXNValue.createNull();
        // Value
        if (isFunctionValue(value))
            throw new Error(`Function 'Value' is not yet supported as edge prediction input`);
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
            return FXNValue.createArray(new BoolArray([+value]), null, 1);
        // Image
        if (isImage(value))
            return FXNValue.createImage(value, 0);
        // List
        if (Array.isArray(value))
            return FXNValue.createList(value);
        // Dict
        if (typeof(value) === "object")
            return FXNValue.createDict(value);
        throw new Error(`Failed to create edge prediction value for unsupported type: ${typeof(value)}`);
    }

    private getPredictUrl (tag: string, query: Record<string, boolean | string | number>) {
        const qs = Object.entries(query)
            .filter(([key, value]) => value != null)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join("&");
        return `${this.client.url}/predict/${tag}?${qs}`;
    }

    private async serializeCloudInputs (
        inputs: Record<string, PlainValue | Value>,
        minUploadSize: number = 4096
    ): Promise<Record<string, Value>> {
        // Check
        if (!inputs)
            return null;
        // Serialize
        const key = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); // this doesn't have to be robust
        const entries = await Promise.all(Object.entries(inputs)
            .map(([name, value]) => this.toValue({ value, name, minUploadSize, key })
            .then(f => ({ ...f, name })))
        );
        const result = Object.fromEntries(entries.map(({ name, ...value }) => [name, value as Value]));
        // Return
        return result;
    }

    private async parseResults (rawResults: Value[], rawOutputs: boolean): Promise<(Value | PlainValue)[]> {
        return rawResults && !rawOutputs ? 
            await Promise.all(rawResults.map(value => this.toObject({ value }))) :
            rawResults;
    }
}

async function getValueData (url: string): Promise<ArrayBuffer> {
    // Data URL
    if (url.startsWith("data:"))
        return (parseDataURL(url).body as Uint8Array).buffer
    // Download
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return buffer;
}

function toTensorOrNumber (
    buffer: ArrayBuffer,
    type: Dtype,
    shape: number[]
): number | bigint | boolean | Tensor {
    const CTOR_MAP: Record<Dtype, TensorConstructible> = {
        "float32":  Float32Array,
        "float64":  Float64Array,
        "int8":     Int8Array,
        "int16":    Int16Array,
        "int32":    Int32Array,
        "int64":    BigInt64Array,
        "uint8":    Uint8Array,
        "uint16":   Uint16Array,
        "uint32":   Uint32Array,
        "uint64":   BigUint64Array,
        "bool":     BoolArray
    } as any;
    const data = new CTOR_MAP[type](buffer);
    return shape.length > 0 ? { data, shape } satisfies Tensor : type === "bool" ? !!data[0] : data[0];
}

interface TensorConstructible {
    new (buffer: ArrayBuffer): TypedArray;
}

function toImage (buffer: ArrayBuffer, fxnc: FXNC): Image { // CHECK // NodeJS
    const { FXNValue } = fxnc;
    let bufferValue: FXNValue;
    let imageValue: FXNValue;
    try {
        bufferValue = FXNValue.createBinary(buffer, 0);
        imageValue = FXNValue.createByDeserializingValue(bufferValue, "image", 0);
        return imageValue.toObject() as Image;
    } finally {
        bufferValue?.dispose();
        imageValue?.dispose();
    }
}

function getTypedArrayDtype (data: TypedArray | ArrayBuffer): Dtype {
    if (data instanceof BoolArray)          return "bool";
    if (data instanceof Float32Array)       return "float32";
    if (data instanceof Float64Array)       return "float64";
    if (data instanceof Int8Array)          return "int8";
    if (data instanceof Int16Array)         return "int16";
    if (data instanceof Int32Array)         return "int32";
    if (data instanceof BigInt64Array)      return "int64";
    if (data instanceof Uint8Array)         return "uint8";
    if (data instanceof Uint8ClampedArray)  return "uint8";
    if (data instanceof Uint16Array)        return "uint16";
    if (data instanceof Uint32Array)        return "uint32";
    if (data instanceof BigUint64Array)     return "uint64";
    return "binary";
}

function assert (condition: any, message: string) {
    if (!condition)
        throw new Error(`Function Error: ${message ?? "An unknown error occurred"}`);
}
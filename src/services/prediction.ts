/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { isBrowser, isDeno, isNode, isWebWorker } from "browser-or-node"
import parseDataURL from "data-urls"
import { GraphClient } from "../graph"
import { Dtype, Image, PlainValue, Prediction, PredictorType, Tensor, TypedArray, UploadType, Value } from "../types"
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
     * Specify this to override the current client configuration token.
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
    private readonly cache: Map<string, number>;
    private fxnc: any;
    private readonly FXNC_DATA_ROOT = "/fxn";
    private readonly FXNC_CACHE_ROOT = `${this.FXNC_DATA_ROOT}/cache`;
    private readonly FXNC_VERSION = "0.0.14";
    //private readonly FXNC_LIB_URL_BASE = `https://cdn.fxn.ai/edgefxn/${this.FXNC_VERSION}`;
    private readonly FXNC_LIB_URL_BASE = "";

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
        // Load fxnc
        this.fxnc = this.fxnc ?? await this.loadFxnc();
        // Check if cached
        const {
            tag,
            inputs,
            rawOutputs,
            dataUrlLimit,
            client = CLIENT,
            configuration = this.getConfigurationId()
        } = input;
        if (this.cache.has(tag) && !rawOutputs)
            return this.predict(tag, this.cache.get(tag), inputs);
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
        //const prediction = await response.json();
        const prediction = {
            tag: "@natml/movenet-multipose",
            type: PredictorType.Edge,
            configuration: "hello",
            resources: [
                { type: "dso", url: "http://localhost:3000/libPredictor.so" },
                { type: "bin", url: "http://localhost:3000/ec96df50080fcb1c865b1631a5d842318242d4553852c24bdea403a0f5f5836c" },
            ]
        } as any;
        // Check
        //if (!response.ok)
        //    throw new Error(prediction.errors?.[0].message ?? "An unknown error occurred");
        // Parse
        prediction.results = await this.parseResults(prediction.results, rawOutputs);
        // Check edge prediction
        if (prediction.type !== PredictorType.Edge || rawOutputs)
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
    public async * stream (input: CreatePredictionInput): AsyncGenerator<Prediction> {
        // Load fxnc
        this.fxnc = this.fxnc ?? await this.loadFxnc();
        // Check if cached
        const {
            tag,
            inputs,
            rawOutputs,
            dataUrlLimit,
            client = CLIENT,
            configuration = this.getConfigurationId()
        } = input;
        if (this.cache.has(tag) && !rawOutputs) {
            yield this.predict(tag, this.cache.get(tag), inputs);
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
            // Check edge prediction
            if (prediction.type !== PredictorType.Edge || rawOutputs)
                return prediction;
             // Load edge predictor
            const predictor = await this.load(prediction);
            this.cache.set(tag, predictor);
            // Yield
            yield !!inputs ? this.predict(tag, predictor, inputs) : prediction;
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
            const data = await this.storage.upload({ name, buffer: value.data.buffer, type: UploadType.Value, dataUrlLimit, key });
            const dtype = getTypedArrayDtype(value.data);
            const type = dtypeToString(dtype);
            return { data, type, shape: value.shape };
        }
        // Typed array
        if (isTypedArray(value))
            return await this.toValue({ ...input, value: { data: value, shape: [value.length] } });
        // Binary
        if (value instanceof ArrayBuffer) {
            const data = await this.storage.upload({ name, buffer: value, type: UploadType.Value, dataUrlLimit, key });
            return { data, type: "binary" };
        }
        // String
        if (typeof(value) === "string") {
            const buffer = new TextEncoder().encode(value).buffer;
            const data = await this.storage.upload({ name, buffer, type: UploadType.Value, dataUrlLimit, key });
            return { data, type: "string" };
        }
        // Number
        if (typeof(value) === "number") {
            const isInt = Number.isInteger(value);
            const buffer = isInt ? new Int32Array([ value as number ]).buffer : new Float32Array([ value as number ]).buffer;
            const data = await this.storage.upload({ name, buffer, type: UploadType.Value, dataUrlLimit, key });
            const type = isInt ? "int32" : "float32";
            return { data, type, shape: [] };
        }
        // Boolean
        if (typeof(value) === "boolean") {
            const buffer = new Uint8Array([ +value ]).buffer;
            const data = await this.storage.upload({ name, buffer, type: UploadType.Value, dataUrlLimit, key });
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
            const data = await this.storage.upload({ name, buffer, type: UploadType.Value, dataUrlLimit, key });
            return { data, type: "bool", shape: [value.length] };
        }
        // List
        if (Array.isArray(value)) {
            const serializedValue = JSON.stringify(value);
            const buffer = new TextEncoder().encode(serializedValue).buffer;
            const data = await this.storage.upload({ name, buffer, type: UploadType.Value, dataUrlLimit, key });
            return { data, type: "list" };
        }
        // Dict
        if (typeof(value) === "object") {
            const serializedValue = JSON.stringify(value);
            const buffer = new TextEncoder().encode(serializedValue).buffer;
            const data = await this.storage.upload({ name, buffer, type: UploadType.Value, dataUrlLimit, key });
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
        // Null
        if (type === "null")
            return null;
        // Download
        const buffer = await getValueData(data);
        // Tensor
        const ARRAY_TYPES: Dtype[] = [
            "float16", "float32", "float64",
            "int8", "int16", "int32", "int64",
            "uint8", "uint16", "uint32", "uint64"
        ];
        if (ARRAY_TYPES.includes(type))
            return toTypedArrayOrNumber(buffer, type, shape);
        // Boolean
        if (type === "bool")
            return toBooleanArrayOrBoolean(buffer, shape);
        // String
        if (type === "string")
            return new TextDecoder().decode(buffer);
        // JSON
        const JSON_TYPES: Dtype[] = ["list", "dict"];
        if (JSON_TYPES.includes(type))
            return JSON.parse(new TextDecoder().decode(buffer));
        // Binary
        if (type === "binary")
            return buffer;
        // Return Function value
        return input.value;
    }

    private async loadFxnc (): Promise<any> { // INCOMPLETE // Mount IDBFS for caching
        // Check env
        if (!isBrowser)
            return null;
        // Load
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `${this.FXNC_LIB_URL_BASE}/Function.js`;
            script.onerror = error => reject(`Function Error: Failed to load Function implementation for in-browser predictions with error: ${error}`);
            script.onload = async () => {
                // Get loader
                const name = "__fxn";
                const locateFile = (path: string) => path === "Function.wasm" ? `${this.FXNC_LIB_URL_BASE}/Function.wasm` : path;
                const moduleLoader = (window as any)[name];
                (window as any)[name] = null;
                try {
                    // Load
                    const fxnc = await moduleLoader({ locateFile });
                    // Mount fs
                    fxnc.FS.mkdir(this.FXNC_DATA_ROOT);
                    //fxnc.FS.mount(fxnc.IDBFS, {}, this.FXNC_DATA_ROOT);
                    fxnc.FS.mkdir(this.FXNC_CACHE_ROOT);
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

    private async load (prediction: Prediction): Promise<number> {
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
            for (const resource of resources) {
                // Check type
                if (["fxn", "js"].includes(resource.type))
                    continue;
                // Get path
                const name = resource.name ?? getResourceName(resource.url);
                const path = `${this.FXNC_CACHE_ROOT}/${name}`;
                const stat = fxnc.FS.analyzePath(path);
                // Download
                if (!stat.exists) {
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
                // Preload so Chrome doesn't bark at us
                if (resource.type === "dso")
                    await fxnc._FXNPreloadResource(path);
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
                const pValue = this.plainToEdgeValue(value);
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
                const value = this.edgeToPlainValue(pValue);
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

    private plainToEdgeValue (value: PlainValue | Value): number {
        const fxnc = this.fxnc;
        const ppValue = fxnc._malloc(4);
        try {
            // Null
            if (value === null) {
                const status = fxnc._FXNValueCreateNull(ppValue);
                cassert(status, `Failed to create null value with status: ${status}`);
                return fxnc.getValue(ppValue, "*");
            }
            // Value
            if (isFunctionValue(value))
                assert(false, `Function 'Value' is not yet supported as edge prediction input`);
            // Tensor
            if (isTensor(value)) {
                const { data, shape } = value;
                const dtype = getTypedArrayDtype(data);
                const elementCount = shape.reduce((a, b) => a * b, 1);
                const pBuffer = fxnc._malloc(data.byteLength);
                const pShape = fxnc._malloc(elementCount * Int32Array.BYTES_PER_ELEMENT);
                const srcView = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
                const dstView = new Uint8Array(fxnc.HEAPU8.buffer, pBuffer, data.byteLength);
                const shapeView = new Int32Array(fxnc.HEAP32.buffer, pShape, elementCount);
                dstView.set(srcView);
                shapeView.set(shape);
                const status = fxnc._FXNValueCreateArray(pBuffer, pShape, shape.length, dtype, 1, ppValue);
                fxnc._free(pBuffer);
                fxnc._free(pShape);
                cassert(status, `Failed to create array value with status: ${status}`);
                return fxnc.getValue(ppValue, "*");
            }
            // Typed array
            if (ArrayBuffer.isView(value)) {
                const byteSize = (value.constructor as any).BYTES_PER_ELEMENT;
                const elements = value.byteLength / byteSize;
                return this.plainToEdgeValue({ data: value, shape: [elements] });
            }
            // Binary
            if (value instanceof ArrayBuffer) {
                const pBuffer = fxnc._malloc(value.byteLength);
                const srcView = new Uint8Array(value);
                const dstView = new Uint8Array(fxnc.HEAPU8.buffer, pBuffer, value.byteLength);
                dstView.set(srcView);
                const status = fxnc._FXNValueCreateBinary(pBuffer, value.byteLength, 1, ppValue);
                fxnc._free(pBuffer);
                cassert(status, `Failed to create binary value with status: ${status}`);
                return fxnc.getValue(ppValue, "*");
            }
            // String
            if (typeof(value) === "string") {
                const length = fxnc.lengthBytesUTF8(value) + 1;
                const pStr = fxnc._malloc(length);
                fxnc.stringToUTF8(value, pStr, length);
                const status = fxnc._FXNValueCreateString(pStr, ppValue);
                fxnc._free(pStr);
                cassert(status, `Failed to create string value with status: ${status}`);
                return fxnc.getValue(ppValue, "*");
            }
            // Number
            if (typeof(value) === "number") {
                const data = Number.isInteger(value) ? new Int32Array([value]) : new Float32Array([value]);
                return this.plainToEdgeValue({ data, shape: [] });
            }
            // Bigint
            if (typeof(value) === "bigint") {
                const data = new BigInt64Array([value]);
                return this.plainToEdgeValue({ data, shape: [] });
            }
            // Boolean
            if (typeof(value) === "boolean")
                return this.plainToEdgeValue({ data: new BoolArray([+value]), shape: [] });
            // Image
            if (isImage(value)) {
                const { data, width, height } = value;
                const bufferSize = width * height * 4;
                const pBuffer = fxnc._malloc(bufferSize);
                const dstView = new Uint8Array(fxnc.HEAPU8.buffer, pBuffer, bufferSize);
                dstView.set(data);
                const status = fxnc._FXNValueCreateImage(pBuffer, width, height, 4, 1, ppValue);
                fxnc._free(pBuffer);
                cassert(status, `Failed to create image value with status: ${status}`);
                return fxnc.getValue(ppValue, "*");
            }
            // List
            if (Array.isArray(value)) {
                const serializedValue = JSON.stringify(value);
                const length = fxnc.lengthBytesUTF8(serializedValue) + 1;
                const pStr = fxnc._malloc(length);
                fxnc.stringToUTF8(serializedValue, pStr, length);
                const status = fxnc._FXNValueCreateList(pStr, ppValue);
                fxnc._free(pStr);
                cassert(status, `Failed to create list value with status: ${status}`);
                return fxnc.getValue(ppValue, "*");
            }
            // Dict
            if (typeof(value) === "object") {
                const serializedValue = JSON.stringify(value);
                const length = fxnc.lengthBytesUTF8(serializedValue) + 1;
                const pStr = fxnc._malloc(length);
                fxnc.stringToUTF8(serializedValue, pStr, length);
                const status = fxnc._FXNValueCreateDict(pStr, ppValue);
                fxnc._free(pStr);
                cassert(status, `Failed to create dict value with status: ${status}`);
                return fxnc.getValue(ppValue, "*");
            }
            // Unknown
            assert(false, `Failed to create edge prediction value for unsupported type: ${typeof(value)}`);
        } finally {
            fxnc._free(ppValue);
        }
    }

    private edgeToPlainValue (pValue: number): PlainValue {
        const fxnc = this.fxnc;
        const ppData = fxnc._malloc(4);
        const pType = fxnc._malloc(4);
        const pDims = fxnc._malloc(4);
        fxnc._FXNValueGetData(pValue, ppData);
        fxnc._FXNValueGetType(pValue, pType);
        fxnc._FXNValueGetDimensions(pValue, pDims);
        const pData = fxnc.getValue(ppData, "*");
        const type = fxnc.getValue(pType, "i32");
        const dims = fxnc.getValue(pDims, "i32");
        const pShape = fxnc._malloc(dims * 4);
        fxnc._FXNValueGetShape(pValue, pShape, dims);
        const shapeArray = new Int32Array(fxnc.HEAP32.buffer, pShape, dims);
        const shape = [...shapeArray];
        const elementCount = shape.reduce((a, b) => a * b, 1);
        try {
            switch(type) {
                case FXNDtype.Null:     return null;
                case FXNDtype.Float16:  throw new Error(`Cannot convert prediction output of type 'float16' to value because it is not supported`);
                case FXNDtype.Float32:  return toTensorOrNumber(new Float32Array(fxnc.HEAPF32.buffer, pData, elementCount), shape);
                case FXNDtype.Float64:  return toTensorOrNumber(new Float64Array(fxnc.HEAPF64.buffer, pData, elementCount), shape);
                case FXNDtype.Int8:     return toTensorOrNumber(new Int8Array(fxnc.HEAP8.buffer, pData, elementCount), shape);
                case FXNDtype.Int16:    return toTensorOrNumber(new Int16Array(fxnc.HEAP16.buffer, pData, elementCount), shape);
                case FXNDtype.Int32:    return toTensorOrNumber(new Int32Array(fxnc.HEAP32.buffer, pData, elementCount), shape);
                case FXNDtype.Int64:    return toTensorOrNumber(new BigInt64Array(fxnc.HEAP8.buffer, pData, elementCount), shape);
                case FXNDtype.Uint8:    return toTensorOrNumber(new Uint8Array(fxnc.HEAPU8.buffer, pData, elementCount), shape);
                case FXNDtype.Uint16:   return toTensorOrNumber(new Uint16Array(fxnc.HEAPU16.buffer, pData, elementCount), shape);
                case FXNDtype.Uint32:   return toTensorOrNumber(new Uint32Array(fxnc.HEAPU32.buffer, pData, elementCount), shape);
                case FXNDtype.Uint64:   return toTensorOrNumber(new BigUint64Array(fxnc.HEAP8.buffer, pData, elementCount), shape);
                case FXNDtype.Bool:     return toTensorOrBoolean(new Uint8Array(fxnc.HEAPU8.buffer, pData, elementCount), shape);
                case FXNDtype.String:   return fxnc.UTF8ToString(pData);
                case FXNDtype.List:     return JSON.parse(fxnc.UTF8ToString(pData));
                case FXNDtype.Dict:     return JSON.parse(fxnc.UTF8ToString(pData));
                case FXNDtype.Image:    return toImage(new Uint8Array(fxnc.HEAPU8.buffer, pData, elementCount), shape);
                case FXNDtype.Binary:   return toArrayBuffer(new Uint8Array(fxnc.HEAPU8.buffer, pData, elementCount));
                default:                throw new Error(`Cannot convert prediction output to value because of unknown type: ${type}`);
            }
        } finally {
            fxnc._free(ppData);
            fxnc._free(pType);
            fxnc._free(pDims);
            fxnc._free(pShape);
        }
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

function getResourceName (url: string): string {
    return new URL(url).pathname.split("/").pop();
}

function cloneTypedArray<T extends TypedArray> (input: T): T {
    const constructor = input.constructor as any;
    const buffer = new constructor(input.length);
    buffer.set(input);
    return buffer;
}

function toTensorOrNumber (data: TypedArray, shape: number[]): number | bigint | Tensor { // INCOMPLETE // MERGE DOWN
    return shape.length > 0 ? { data: cloneTypedArray(data), shape } : data[0];
}

function toTensorOrBoolean (data: Uint8Array, shape: number[]): boolean | Tensor {
    const res = toTensorOrNumber(data, shape);
    return typeof res === "number" ? !!res : res as Tensor;
}

function toTypedArrayOrNumber (
    buffer: ArrayBuffer,
    type: Dtype,
    shape: number[]
): number | bigint | TypedArray | Tensor { // INCOMPLETE // MERGE UP
    const CTOR_MAP = {
        "float32": Float32Array,
        "float64": Float64Array,
        "int8":    Int8Array,
        "int16":   Int16Array,
        "int32":   Int32Array,
        "int64":   BigInt64Array,
        "uint8":   Uint8Array,
        "uint16":  Uint16Array,
        "uint32":  Uint32Array,
        "uint64":  BigUint64Array,
    } as any;
    const data = new CTOR_MAP[type](buffer);
    return shape.length > 0 ? shape.length > 1 ? { data, shape } : data : data[0];
}

function toBooleanArrayOrBoolean (buffer: ArrayBuffer, shape: number[]): boolean | boolean[] {
    const tensor = new Uint8Array(buffer);
    const array = Array.from(tensor as Uint8Array).map(num => num !== 0);
    return shape.length > 0 ? array : array[0];
}

function toImage (data: Uint8Array, shape: number[]): Image {
    return { data: cloneTypedArray(data), width: shape[2], height: shape[1] };
}

function toArrayBuffer (data: Uint8Array): ArrayBuffer {
    return cloneTypedArray(data).buffer;
}

function getTypedArrayDtype (data: TypedArray | ArrayBuffer): FXNDtype {
    if (data instanceof BoolArray)          return FXNDtype.Bool;
    if (data instanceof Float32Array)       return FXNDtype.Float32;
    if (data instanceof Float64Array)       return FXNDtype.Float64;
    if (data instanceof Int8Array)          return FXNDtype.Int8;
    if (data instanceof Int16Array)         return FXNDtype.Int16;
    if (data instanceof Int32Array)         return FXNDtype.Int32;
    if (data instanceof BigInt64Array)      return FXNDtype.Int64;
    if (data instanceof Uint8Array)         return FXNDtype.Uint8;
    if (data instanceof Uint8ClampedArray)  return FXNDtype.Uint8;
    if (data instanceof Uint16Array)        return FXNDtype.Uint16;
    if (data instanceof Uint32Array)        return FXNDtype.Uint32;
    if (data instanceof BigUint64Array)     return FXNDtype.Uint64;
    return FXNDtype.Binary;
}

const enum FXNDtype {
    Null = 0,
    Float16 = 1,
    Float32 = 2,
    Float64 = 3,
    Int8 = 4,
    Int16 = 5,
    Int32 = 6,
    Int64 = 7,
    Uint8 = 8,
    Uint16 = 9,
    Uint32 = 10,
    Uint64 = 11,
    Bool = 12,
    String = 13,
    List = 14,
    Dict = 15,
    Image = 16,
    Binary = 17
}

function dtypeToString (type: FXNDtype): Dtype {
    switch (type) {
        case FXNDtype.Bool:     return "bool";
        case FXNDtype.Float32:  return "float32";
        case FXNDtype.Float64:  return "float64";
        case FXNDtype.Int8:     return "int8";
        case FXNDtype.Int16:    return "int16";
        case FXNDtype.Int32:    return "int32";
        case FXNDtype.Int64:    return "int64";
        case FXNDtype.Uint8:    return "uint8";
        case FXNDtype.Uint16:   return "uint16";
        case FXNDtype.Uint32:   return "uint32";
        case FXNDtype.Uint64:   return "uint64";
        case FXNDtype.Binary:   return "binary";
        default:                throw new Error(`Cannot convert data type ${type} to string`);
    }
}

function assert (condition: any, message: string) {
    if (!condition)
        throw new Error(`Function Error: ${message ?? "An unknown error occurred"}`);
}

function cassert (condition: number, message: string) {
    assert(condition === 0, message);        
}

const CLIENT = !isBrowser ? !isDeno ? !isNode ? !isWebWorker ?
    "edge" : // e.g. Vercel Serverless Functions with edge runtime
    "webworker" :
    "node" :
    "deno" :
    "browser";

class BoolArray extends Uint8Array { }
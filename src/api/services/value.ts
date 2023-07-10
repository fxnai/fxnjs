/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import parseDataURL from "data-urls"
import { Dtype, PlainValue, TypedArray, UploadType, Value } from "../types"
import { StorageService } from "./storage"

export interface ToFunctionValueInput {
    /**
     * Input value.
     */
    value: Value | PlainValue;
    /**
     * Value name.
     */
    name: string;
    /**
     * Storage service for uploading the value.
     */
    storage: StorageService;
    /**
     * Tensor value shape for input `TypedArray` tensors.
     */
    shape?: number[];
    /**
     * Value larger than this size in bytes will be uploaded.
     */
    minUploadSize?: number;
    /**
     * Unused.
     */
    key?: string;
}

export interface ToPlainValueInput {
    /**
     * Input Function value.
     */
    value: Value;
}

/**
 * Convert a plain value into a Function value.
 * @param input Input arguments.
 * @returns Function value.
 */
export async function toFunctionValue (input: ToFunctionValueInput): Promise<Value> {
    const { value, name, storage, shape, minUploadSize: dataUrlLimit = 4096, key } = input;
    // Null
    if (value === null)
        return { data: null, type: "null" };
    // Value
    if (isFunctionValue(value))
        return value;
    // Typed array
    if (ArrayBuffer.isView(value)) {
        const data = await storage.upload({ name, buffer: value.buffer, type: UploadType.Value, dataUrlLimit, key });
        const type = getTypedArrayDtype(value);
        return { data, type, shape };
    }
    // Binary
    if (value instanceof ArrayBuffer) {
        const data = await storage.upload({ name, buffer: value, type: UploadType.Value, dataUrlLimit, key });
        return { data, type: "binary" };
    }
    // String
    if (typeof(value) === "string") {
        const buffer = new TextEncoder().encode(value).buffer;
        const data = await storage.upload({ name, buffer, type: UploadType.Value, dataUrlLimit, key });
        return { data, type: "string" };
    }
    // Integer
    if (typeof(value) === "number") {
        const isInt = Number.isInteger(value);
        const buffer = isInt ? new Int32Array([ value as number ]).buffer : new Float32Array([ value as number ]).buffer;
        const data = await storage.upload({ name, buffer, type: UploadType.Value, dataUrlLimit, key });
        const type = isInt ? "int32" : "float32";
        return { data, type, shape: [] };
    }
    // Boolean
    if (typeof(value) === "boolean") {
        const buffer = new Uint8Array([ +value ]).buffer;
        const data = await storage.upload({ name, buffer, type: UploadType.Value, dataUrlLimit, key });
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
        const data = await storage.upload({ name, buffer, type: UploadType.Value, dataUrlLimit, key });
        return { data, type: "bool", shape: shape ?? [value.length] };
    }
    // List
    if (Array.isArray(value)) {
        const serializedValue = JSON.stringify(value);
        const buffer = new TextEncoder().encode(serializedValue).buffer;
        const data = await storage.upload({ name, buffer, type: UploadType.Value, dataUrlLimit, key });
        return { data, type: "list" };
    }
    // Dict
    if (typeof(value) === "object") {
        const serializedValue = JSON.stringify(value);
        const buffer = new TextEncoder().encode(serializedValue).buffer;
        const data = await storage.upload({ name, buffer, type: UploadType.Value, dataUrlLimit, key });
        return { data, type: "dict" };
    }
    // Throw
    throw new Error(`Value ${value} of type ${typeof(value)} cannot be converted to a Function value`);
}

/**
 * Convert a Function value to a plain value.
 * If the Function value cannot be converted to a plain value, the Function value is returned as-is.
 * @param input Input arguments.
 * @returns Plain value.
 */
export async function toPlainValue (input: ToPlainValueInput): Promise<PlainValue | Value> {
    const { value: { data, type } } = input;
    // Null
    if (type === "null")
        return null;
    // Download
    const buffer = await getValueData(data);
    // Tensor
    const ARRAY_TYPES: Dtype[] = ["float16", "float32", "float64", "int8", "int16", "int32", "int64", "uint8", "uint16", "uint32", "uint64"];
    if (ARRAY_TYPES.includes(type))
        return toTypedArrayOrNumber(buffer, type);
    // Boolean
    if (type === "bool")
        return toBoolean(buffer);
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

/**
 * Check whether an input value is a Function value.
 * @param value Input value.
 * @returns Whether the input value is a Function value.
 */
export function isFunctionValue (value: any): value is Value {
    // Check null
    if (value == null)
        return false;
    // Check type
    if (!value.type)
        return false;
    // Check data // Can be `null` but must always exist
    if (value.data === undefined)
        return false;
    // Return
    return true;
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

function toTypedArray (buffer: ArrayBuffer, type: Dtype): TypedArray {
    switch (type) {
        case "float32": return new Float32Array(buffer);
        case "float64": return new Float64Array(buffer);
        case "int8":    return new Int8Array(buffer);
        case "int16":   return new Int16Array(buffer);
        case "int32":   return new Int32Array(buffer);
        case "int64":   return new BigInt64Array(buffer);
        case "uint8":   return new Uint8Array(buffer);
        case "uint16":  return new Uint16Array(buffer);
        case "uint32":  return new Uint32Array(buffer);
        case "uint64":  return new BigUint64Array(buffer);
        default:        return null;
    }
}

function toTypedArrayOrNumber (buffer: ArrayBuffer, type: Dtype): number | TypedArray {
    const tensor = toTypedArray(buffer, type);
    return tensor.length > 1 ? tensor : tensor[0] as number;
}

function toBoolean (buffer: ArrayBuffer): boolean | boolean[] {
    const tensor = toTypedArray(buffer, "uint8");
    const array = Array.from(tensor as Uint8Array).map(num => num !== 0);
    return array.length > 1 ? array : array[0];
}

function getTypedArrayDtype (value: ArrayBufferView): Dtype {
    if (value instanceof Float32Array)
        return "float32";
    if (value instanceof Float64Array)
        return "float64";
    if (value instanceof Int8Array)
        return "int8";
    if (value instanceof Int16Array)
        return "int16";
    if (value instanceof Int32Array)
        return "int32";
    if (value instanceof BigInt64Array)
        return "int64";
    if (value instanceof Uint8Array)
        return "uint8";
    if (value instanceof Uint8ClampedArray)
        return "uint8";
    if (value instanceof Uint16Array)
        return "uint16";
    if (value instanceof Uint32Array)
        return "uint32";
    if (value instanceof BigUint64Array)
        return "uint64";
    return "binary";
}
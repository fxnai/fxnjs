/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import fetch from "cross-fetch"
import parseDataURL from "data-urls"
import { Dtype, Feature, FeatureValue, UploadType } from "../types"
import { StorageService } from "./storage"

export interface FeatureToValueInput {
    /**
     * Input feature.
     */
    feature: Feature;
}

export interface FeatureFromValueInput {
    /**
     * Input value.
     */
    value: FeatureValue | Feature;
    /**
     * Feature name.
     */
    name: string;
    /**
     * Storage service for uploading feature.
     */
    storage: StorageService;
    /**
     * Features larger than this size in bytes will be uploaded.
     */
    minUploadSize?: number;
    key?: string;
}

export async function featureToValue (input: FeatureToValueInput): Promise<Feature | FeatureValue> {
    const { feature } = input;
    const buffer = await getFeatureData(feature.data);
    const view = new DataView(buffer);
    switch (feature.type) {
        case "int8":    return arrayFeatureToValue(feature, offset => view.getInt8(offset));
        case "int16":   return arrayFeatureToValue(feature, offset => view.getInt16(offset, true));
        case "int32":   return arrayFeatureToValue(feature, offset => view.getInt32(offset, true));
        case "int64":   return arrayFeatureToValue(feature, offset => view.getBigInt64(offset, true) as unknown as number);
        case "uint8":   return arrayFeatureToValue(feature, offset => view.getUint8(offset));
        case "uint16":  return arrayFeatureToValue(feature, offset => view.getUint16(offset, true));
        case "uint32":  return arrayFeatureToValue(feature, offset => view.getUint32(offset, true));
        case "uint64":  return arrayFeatureToValue(feature, offset => view.getBigUint64(offset, true) as unknown as number);
        case "float32": return arrayFeatureToValue(feature, offset => view.getFloat32(offset, true));
        case "float64": return arrayFeatureToValue(feature, offset => view.getFloat64(offset, true));
        case "bool":    return numberToBoolean(arrayFeatureToValue(feature, offset => view.getUint8(offset)));
        case "string":  return new TextDecoder().decode(view);
        case "list":    return JSON.parse(new TextDecoder().decode(view));
        case "dict":    return JSON.parse(new TextDecoder().decode(view));
    }
    return feature;
}

export async function featureFromValue (input: FeatureFromValueInput): Promise<Feature> {
    const { storage, value, name, minUploadSize: dataUrlLimit, key } = input;
    // Feature
    if (isFeature(value))
        return value;
    // Array
    if (Array.isArray(value)) {
        const isHomogenous = value.every(v => typeof(v) === typeof(value[0]));
        const isBoolTensor = isHomogenous && typeof(value[0]) === "boolean";
        const isIntTensor = isHomogenous && typeof(value[0]) === "number" && Number.isInteger(value[0]);
        const isFloatTensor = isHomogenous && typeof(value[0]) === "number" && !isIntTensor;
        const boolBuffer = isBoolTensor ? new Uint8Array(value.map(v => +v)).buffer : null;
        const intBuffer = isIntTensor ? new Int32Array(value as number[]).buffer : null;
        const floatBuffer = isFloatTensor ? new Float32Array(value as number[]).buffer : null;
        const buffer = boolBuffer ?? intBuffer ?? floatBuffer ?? new TextEncoder().encode(JSON.stringify(value)).buffer;
        const data = await storage.upload({ name, buffer, type: UploadType.Feature, dataUrlLimit, key });
        const type = !isBoolTensor ? !isFloatTensor ? !isIntTensor ? "list" : "int32" : "float32" : "bool";
        const shape = [value.length];
        return { data, type, shape };
    }
    // String
    if (typeof(value) === "string") {
        const buffer = new TextEncoder().encode(value).buffer;
        const data = await storage.upload({ name, buffer, type: UploadType.Feature, dataUrlLimit, key });
        return { data, type: "string" };
    }
    // Boolean
    if (typeof(value) === "boolean") {
        const buffer = new Uint8Array([ +value ]).buffer;
        const data = await storage.upload({ name, buffer, type: UploadType.Feature, dataUrlLimit, key });
        return { data, type: "bool", shape: [] };
    }
    // Integer
    if (typeof(value) === "number") {
        const isInt = Number.isInteger(value);
        const buffer = isInt ? new Int32Array([ value as number ]).buffer : new Float32Array([ value as number ]).buffer;
        const data = await storage.upload({ name, buffer, type: UploadType.Feature, dataUrlLimit, key });
        return { data, type: isInt ? "int32" : "float32", shape: [] };
    }
    // Dict
    if (typeof(value) === "object") {
        const serializedValue = JSON.stringify(value);
        const buffer = new TextEncoder().encode(serializedValue).buffer;
        const data = await storage.upload({ name, buffer, type: UploadType.Feature, dataUrlLimit, key });
        return { data, type: "dict" };
    }
    // Throw
    throw new Error(`Value ${value} of type ${typeof(value)} cannot be converted to a feature`);
}

async function getFeatureData (url: string): Promise<ArrayBuffer> {
    // Data URL
    if (url.startsWith("data:"))
        return (parseDataURL(url).body as Uint8Array).buffer
    // Download
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return buffer;
}

function arrayFeatureToValue (feature: Feature, reader: (offset: number) => number): number | number[] {
    const { type, shape } = feature;
    const scalar = shape.length === 0;
    const length = !scalar ? shape.reduce((a, b) => a * b) : 1;
    const bytesPerElement = getBytesPerElement(type);
    const array = Array.from({ length }, (_, idx) => reader(idx * bytesPerElement));
    return scalar ? array[0] : array;
}

function numberToBoolean (feature: number | number[]): boolean | boolean[] {
    return Array.isArray(feature) ? feature.map(f => f !== 0) : feature !== 0;
}

function getBytesPerElement (dtype: Dtype): number {
    switch (dtype) {
        case "int8":    return Int8Array.BYTES_PER_ELEMENT;
        case "int16":   return Int16Array.BYTES_PER_ELEMENT;
        case "int32":   return Int32Array.BYTES_PER_ELEMENT;
        case "int64":   return BigInt64Array.BYTES_PER_ELEMENT;
        case "uint8":   return Uint8Array.BYTES_PER_ELEMENT;
        case "uint16":  return Uint16Array.BYTES_PER_ELEMENT;
        case "uint32":  return Uint32Array.BYTES_PER_ELEMENT;
        case "uint64":  return BigUint64Array.BYTES_PER_ELEMENT;
        case "float16": return Uint16Array.BYTES_PER_ELEMENT; // forward compatibility?
        case "float32": return Float32Array.BYTES_PER_ELEMENT;
        case "float64": return BigInt64Array.BYTES_PER_ELEMENT;
        case "bool":    return Uint8Array.BYTES_PER_ELEMENT;
        default:        return undefined;
    }
}

function isFeature (feature: any): feature is Feature {
    return feature.data && feature.type;
}
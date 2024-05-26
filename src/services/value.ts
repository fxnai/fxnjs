/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { Image, Tensor, TypedArray, Value } from "../types"

/**
 * Check whether an input value is a Function value.
 * @param value Input value.
 * @returns Whether the input value is a Function value.
 */
export function isFunctionValue (value: any): value is Value {
    // Check null
    if (value == null)
        return false;
    // Check keys
    const VALUE_KEYS = ["data", "type", "shape"]
    if (!Object.keys(value).every(key => VALUE_KEYS.includes(key)))
        return false;
    // Check that the type is populated
    if (!value.type)
        return false;
    // Check null
    if (!value.data && value.type !== "null")
        return false;
    // Pass
    return true;
}

/**
 * Check whether an input value is a Function `Tensor`.
 * @param value Input value.
 * @returns Whether the input value is a tensor.
 */
export function isTensor (value: any): value is Tensor {
    return value != null &&
        ArrayBuffer.isView(value.data) &&
        Array.isArray(value.shape);
}

/**
 * Check whether an input value is a Function `Image`.
 * @param value Input value.
 * @returns Whether the input value is an image.
 */
export function isImage (value: any): value is Image { // CHECK // Channel count
    return value != null &&
        (value.data instanceof Uint8Array || value.data instanceof Uint8ClampedArray) &&
        Number.isInteger(value.width) &&
        Number.isInteger(value.height);
}

/**
 * Check whether an input value is a `TypedArray`
 * @param value Input value.
 * @returns Whether the input value is a typed array.
 */
export function isTypedArray (value: any): value is TypedArray {
    if (value instanceof Float32Array)      return true;
    if (value instanceof Float64Array)      return true;
    if (value instanceof Int8Array)         return true;
    if (value instanceof Int16Array)        return true;
    if (value instanceof Int32Array)        return true;
    if (value instanceof BigInt64Array)     return true;
    if (value instanceof Uint8Array)        return true;
    if (value instanceof Uint8ClampedArray) return true;
    if (value instanceof Uint16Array)       return true;
    if (value instanceof Uint32Array)       return true;
    if (value instanceof BigUint64Array)    return true;
    return false;
}
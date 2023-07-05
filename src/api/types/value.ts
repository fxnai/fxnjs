/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import { Dtype } from "./dtype"

/**
 * A `TypedArray` instance.
 */
export type TypedArray =
    Float32Array        |
    Float64Array        |
    Int8Array           |
    Int16Array          |
    Int32Array          |
    BigInt64Array       |
    Uint8Array          |
    Uint8ClampedArray   |
    Uint16Array         |
    Uint32Array         |
    BigUint64Array;

/**
 * Plain value.
 */
export type PlainValue =
    string                          |
    number                          |
    number[]                        |
    boolean                         |
    boolean[]                       |
    (string | number | boolean)[]   |
    { [key: string]: any }          |
    TypedArray;

/**
 * Prediction value.
 */
export interface Value {
    /**
     * Value data URL.
     * This could either be a remote or data URL.
     */
    data: string;
    /**
     * Value data type.
     */
    type: Dtype;
    /**
     * Value shape.
     * This is only populated for array values.
     */
    shape?: number[];
}
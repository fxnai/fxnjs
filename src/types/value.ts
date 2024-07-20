/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

/**
 * Value data type.
 */
export type Dtype =
    "int8"      |
    "int16"     |
    "int32"     |
    "int64"     |
    "uint8"     |
    "uint16"    |
    "uint32"    |
    "uint64"    |
    "float16"   |
    "float32"   |
    "float64"   |
    "bool"      |
    "string"    |
    "list"      |
    "dict"      |
    "image"     |
    "audio"     |
    "video"     |
    "model"     |
    "binary"    |
    "null";

/**
 * Boolean typed array.
 */
export class BoolArray extends Uint8Array { }

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
    BigUint64Array      |
    BoolArray;

/**
 * Image.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ImageData
 */
export interface Image {
    /**
     * Pixel buffer.
     */
    data: Uint8ClampedArray;
    /**
     * Image width.
     */
    width: number;
    /**
     * Image height.
     */
    height: number;
    /**
     * Image channels.
     */
    channels: number;
}

/**
 * Tensor.
 */
export interface Tensor {
    /**
     * Tensor data.
     */
    data: TypedArray;
    /**
     * Tensor shape.
     */
    shape: number[];
}

/**
 * Plain value.
 */
export type PlainValue =
    string                          |
    number                          |
    number[]                        |
    bigint                          |
    boolean                         |
    boolean[]                       |
    (string | number | boolean)[]   |
    { [key: string]: any }          |
    TypedArray                      |
    Tensor                          |
    Image                           |
    ArrayBuffer;

/**
 * Prediction value.
 */
export interface Value {
    /**
     * Value data URL.
     * This could either be a remote or data URL.
     */
    data?: string;
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
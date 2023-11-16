/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import { Image, PlainValue, Tensor, TypedArray, Value } from "../../types"
import { isFunctionValue, isImage, isTensor } from "../value"

const enum Dtype {
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

export function toFunctionValue (value: PlainValue | Value, module: any): number {
    const ppValue = module._malloc(4);
    try {
        // Null
        if (value === null) {
            module._FXNValueCreateNull(ppValue);
            return module.getValue(ppValue, "*");
        }
        // Value
        if (isFunctionValue(value))
            throw new Error(`Function 'Value' is not yet supported as edge prediction input`);
        // Tensor
        if (isTensor(value)) {
            const { data, shape } = value;
            const dtype = dtypeFromTypedArray(data);
            const elementCount = shape.reduce((a, b) => a * b, 1);
            const pBuffer = module._malloc(data.byteLength);
            const pShape = module._malloc(elementCount * 4);
            const srcView = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            const dstView = new Uint8Array(module.HEAPU8.buffer, pBuffer, data.byteLength);
            const shapeView = new Int32Array(module.HEAP32.buffer, pShape, elementCount);
            dstView.set(srcView);
            shapeView.set(shape);
            module._FXNValueCreateArray(pBuffer, pShape, shape.length, dtype, 1, ppValue);
            module._free(pBuffer);
            module._free(pShape);
            return module.getValue(ppValue, "*");
        }
        // Typed array
        if (ArrayBuffer.isView(value)) {
            const byteSize = (value.constructor as any).BYTES_PER_ELEMENT;
            const elements = value.byteLength / byteSize;
            return toFunctionValue({ data: value, shape: [elements] }, module);
        }
        // Binary
        if (value instanceof ArrayBuffer) {
            const pBuffer = module._malloc(value.byteLength);
            const srcView = new Uint8Array(value);
            const dstView = new Uint8Array(module.HEAPU8.buffer, pBuffer, value.byteLength);
            dstView.set(srcView);
            module._FXNValueCreateBinary(pBuffer, value.byteLength, 1, ppValue);
            module._free(pBuffer);
            return module.getValue(ppValue, "*");
        }
        // String
        if (typeof(value) === "string") {
            const length = module.lengthBytesUTF8(value) + 1;
            const pStr = module._malloc(length);
            module.stringToUTF8(value, pStr, length);
            module._FXNValueCreateString(pStr, ppValue);
            module._free(pStr);
            return module.getValue(ppValue, "*");
        }
        // Number
        if (typeof(value) === "number") {
            const data = Number.isInteger(value) ? new Int32Array([value]) : new Float32Array([value]);
            return toFunctionValue({ data, shape: [] }, module);
        }
        // Bigint
        if (typeof(value) === "bigint") {
            const data = new BigInt64Array([value]);
            return toFunctionValue({ data, shape: [] }, module);
        }
        // Boolean
        if (typeof(value) === "boolean")
            return toFunctionValue({ data: new BoolArray([+value]), shape: [] }, module);
        // Image
        if (isImage(value)) {
            const { data, width, height } = value;
            const bufferSize = width * height * 4;
            const pBuffer = module._malloc(bufferSize);
            const dstView = new Uint8Array(module.HEAPU8.buffer, pBuffer, bufferSize);
            dstView.set(data);
            module._FXNValueCreateImage(pBuffer, width, height, 1, ppValue);
            module._free(pBuffer);
            return module.getValue(ppValue, "*");
        }
        // List
        if (Array.isArray(value)) {
            const serializedValue = JSON.stringify(value);
            const length = module.lengthBytesUTF8(serializedValue) + 1;
            const pStr = module._malloc(length);
            module.stringToUTF8(serializedValue, pStr, length);
            module._FXNValueCreateList(pStr, ppValue);
            module._free(pStr);
            return module.getValue(ppValue, "*");
        }
        // Dict
        if (typeof(value) === "object") {
            const serializedValue = JSON.stringify(value);
            const length = module.lengthBytesUTF8(serializedValue) + 1;
            const pStr = module._malloc(length);
            module.stringToUTF8(serializedValue, pStr, length);
            module._FXNValueCreateDict(pStr, ppValue);
            module._free(pStr);
            return module.getValue(ppValue, "*");
        }
    } catch (error) {
        throw error;
    } finally {
        module._free(ppValue);
    }
}

export function toPlainValue (pValue: number, module: any): PlainValue {
    const ppData = module._malloc(4);
    const pType = module._malloc(4);
    const pDims = module._malloc(4);
    module._FXNValueGetData(pValue, ppData);
    module._FXNValueGetType(pValue, pType);
    module._FXNValueGetDimensions(pValue, pDims);
    const pData = module.getValue(ppData, "*");
    const type = module.getValue(pType, "i32");
    const dims = module.getValue(pDims, "i32");
    const pShape = module._malloc(dims * 4);
    module._FXNValueGetShape(pValue, pShape, dims);
    const shapeArray = new Int32Array(module.HEAP32.buffer, pShape, dims);
    const shape = [...shapeArray];
    const elementCount = shape.reduce((a, b) => a * b, 1);
    try {
        switch(type) {
            case Dtype.Null:    return null;
            case Dtype.Float16: throw new Error(`Cannot convert prediction output of type 'float16' to value because it is not supported`);
            case Dtype.Float32: return toTensorOrNumber(new Float32Array(module.HEAPF32.buffer, pData, elementCount), shape);
            case Dtype.Float64: return toTensorOrNumber(new Float64Array(module.HEAPF64.buffer, pData, elementCount), shape);
            case Dtype.Int8:    return toTensorOrNumber(new Int8Array(module.HEAP8.buffer, pData, elementCount), shape);
            case Dtype.Int16:   return toTensorOrNumber(new Int16Array(module.HEAP16.buffer, pData, elementCount), shape);
            case Dtype.Int32:   return toTensorOrNumber(new Int32Array(module.HEAP32.buffer, pData, elementCount), shape);
            case Dtype.Int64:   return toTensorOrNumber(new BigInt64Array(module.HEAP8.buffer, pData, elementCount), shape);
            case Dtype.Uint8:   return toTensorOrNumber(new Uint8Array(module.HEAPU8.buffer, pData, elementCount), shape);
            case Dtype.Uint16:  return toTensorOrNumber(new Uint16Array(module.HEAPU16.buffer, pData, elementCount), shape);
            case Dtype.Uint32:  return toTensorOrNumber(new Uint32Array(module.HEAPU32.buffer, pData, elementCount), shape);
            case Dtype.Uint64:  return toTensorOrNumber(new BigUint64Array(module.HEAP8.buffer, pData, elementCount), shape);
            case Dtype.Bool:    return toTensorOrBoolean(new Uint8Array(module.HEAPU8.buffer, pData, elementCount), shape);
            case Dtype.String:  return module.UTF8ToString(pData);
            case Dtype.List:    return JSON.parse(module.UTF8ToString(pData));
            case Dtype.Dict:    return JSON.parse(module.UTF8ToString(pData));
            case Dtype.Image:   return toImage(new Uint8Array(module.HEAPU8.buffer, pData, elementCount), shape);
            case Dtype.Binary:  return toArrayBuffer(new Uint8Array(module.HEAPU8.buffer, pData, elementCount));
            default:            throw new Error(`Cannot convert prediction output to value because of unknown type: ${type}`);
        }
    } finally {
        module._free(ppData);
        module._free(pType);
        module._free(pDims);
        module._free(pShape);
    }
}

function cloneTypedArray<T extends TypedArray> (input: T): T {
    const constructor = input.constructor as any;
    const buffer = new constructor(input.length);
    buffer.set(input);
    return buffer;
}

function toTensorOrNumber (data: TypedArray, shape: number[]): number | bigint | Tensor {
    return shape.length > 0 ? { data: cloneTypedArray(data), shape } : data[0];
}

function toTensorOrBoolean (data: Uint8Array, shape: number[]): boolean | Tensor {
    const res = toTensorOrNumber(data, shape);
    return typeof res === "number" ? !!res : res as Tensor;
}

function toImage (data: Uint8Array, shape: number[]): Image {
    return { data: cloneTypedArray(data), width: shape[2], height: shape[1] };
}

function toArrayBuffer (data: Uint8Array): ArrayBuffer {
    return cloneTypedArray(data).buffer;
}

function dtypeFromTypedArray (data: TypedArray | ArrayBuffer): Dtype {
    if (data instanceof BoolArray)          return Dtype.Bool;
    if (data instanceof Float32Array)       return Dtype.Float32;
    if (data instanceof Float64Array)       return Dtype.Float64;
    if (data instanceof Int8Array)          return Dtype.Int8;
    if (data instanceof Int16Array)         return Dtype.Int16;
    if (data instanceof Int32Array)         return Dtype.Int32;
    if (data instanceof BigInt64Array)      return Dtype.Int64;
    if (data instanceof Uint8Array)         return Dtype.Uint8;
    if (data instanceof Uint8ClampedArray)  return Dtype.Uint8;
    if (data instanceof Uint16Array)        return Dtype.Uint16;
    if (data instanceof Uint32Array)        return Dtype.Uint32;
    if (data instanceof BigUint64Array)     return Dtype.Uint64;
    throw new Error("Unsupported TypedArray or ArrayBuffer type");
}

class BoolArray extends Uint8Array { }
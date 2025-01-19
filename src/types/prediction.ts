/*
*   Function
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { Value } from "./value"

/**
 * Prediction.
 */
export interface Prediction {
    /**
     * Prediction ID.
     */
    id: string;
    /**
     * Predictor tag.
     */
    tag: string;
    /**
     * Date created.
     */
    created: Date;
    /**
     * Prediction configuration.
     */
    configuration?: string;
    /**
     * Predictor resources.
     */
    resources?: PredictionResource[];
    /**
     * Prediction results.
     */
    results?: Value[];
    /**
     * Prediction latency in milliseconds.
     */
    latency?: number;
    /**
     * Prediction error.
     * This is `null` if the prediction completed successfully.
     */
    error?: string;
    /**
     * Prediction logs.
     */
    logs?: string;    
}

export interface PredictionResource {
    /**
     * Resource type.
     */
    type: string;
    /**
     * Resource URL.
     */
    url: string;
    /**
     * Resource name.
     */
    name?: string;
}

/**
 * Predictor acceleration.
 */
export enum Acceleration {
    /**
     * Automatically choose the best acceleration for the current device.
     */
    Auto = 0,
    /**
     * Predictions run on the CPU.
     */
    CPU = 1 << 0,
    /**
     * Predictions run on the GPU.
     */
    GPU = 1 << 1,
    /**
     * Predictions run on the neural processor.
     */
    NPU = 1 << 2,
}
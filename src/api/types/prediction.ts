/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import { PredictorType } from "./predictor"
import { PlainValue, Value } from "./value"

/**
 * Prediction.
 */
export interface Prediction {
    /**
     * Session ID.
     */
    id: string;
    /**
     * Predictor tag.
     */
    tag: string;
    /**
     * Prediction type.
     */
    type: PredictorType;
    /**
     * Date created.
     */
    created: Date;
    /**
     * Prediction results.
     */
    results?: (Value | PlainValue)[];
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
    /**
     * Predictor implementation.
     */
    implementation?: string;
    /**
     * Predictor resources.
     */
    resources?: PredictionResource[];
}

export interface PredictionResource {
    /**
     * Resource identifier.
     */
    id: string;
    /**
     * Resource URL.
     */
    url: string;
}
/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import type { PredictorType } from "./predictor"
import type { PlainValue, Value } from "./value"

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
     * Prediction type.
     */
    type: PredictorType;
    /**
     * Date created.
     */
    created: Date;
    /**
     * Prediction configuration.
     * This is only populated for `EDGE` predictions.
     */
    configuration?: string;
    /**
     * Predictor resources.
     * This is only populated for `EDGE` predictions.
     */
    resources?: PredictionResource[];
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
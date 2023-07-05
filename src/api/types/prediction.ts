/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

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
     * Endpoint tag.
     */
    tag: string;
    /**
     * Date created.
     */
    created: Date;
}

/**
 * Cloud prediction.
 */
export interface CloudPrediction extends Prediction {
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

/**
 * Edge prediction.
 */
export interface EdgePrediction extends Prediction {
    
}
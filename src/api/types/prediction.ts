/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import { Feature, FeatureValue } from "./feature"

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
    results?: (Feature | FeatureValue)[];
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
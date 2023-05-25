/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import { Dtype } from "./dtype"

/**
 * Prediction feature.
 */
export interface Feature {
    /**
     * Feature data URL.
     * This could either be a remote or data URL.
     */
    data: string;
    /**
     * Feature data type.
     */
    type: Dtype;
    /**
     * Feature shape.
     * This is only populated for array features.
     */
    shape?: number[];
}
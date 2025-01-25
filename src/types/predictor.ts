/*
*   Function
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { User } from "./user"
import type { Dtype } from "./value"

/**
 * Predictor access mode.
 */
export type AccessMode = "PUBLIC" | "PRIVATE";

/**
 * Predictor status.
 */
export type PredictorStatus = "COMPILING" | "ACTIVE" | "INVALID" | "ARCHIVED";

/**
 * Prediction function.
 */
export interface Predictor {
    /**
     * Predictor tag.
     */
    tag: string;
    /**
     * Predictor owner.
     */
    owner: User;
    /**
     * Predictor name.
     */
    name: string;
    /**
     * Predictor status.
     */
    status: PredictorStatus;
    /**
     * Predictor access mode.
     */
    access: AccessMode;
    /**
     * Predictor signature.
     */
    signature: Signature;
    /**
     * Number of predictions made with this predictor.
     */
    predictions: number;
    /**
     * Date created.
     */
    created: Date;
    /**
     * Predictor description.
     */
    description?: string;
    /**
     * Predictor card.
     */
    card?: string;
    /**
     * Predictor media URL.
     * We encourage animated GIF's where possible.
     */
    media?: string;
    /**
     * Predictor provisioning error.
     * This is populated when the predictor `status` is `INVALID`.
     */
    error?: string;
    /**
     * Predictor license URL.
     */
    license?: string;
}

/**
 * Prediction signature.
 */
export interface Signature {
    /**
     * Prediction inputs.
     */
    inputs: Parameter[];
    /**
     * Prediction outputs.
     */
    outputs: Parameter[];
}

/**
 * Prediction parameter.
 * This describes a value that is consumed or produced by a predictor.
 */
export interface Parameter {
    /**
     * Parameter name.
     */
    name: string;
    /**
     * Parameter type.
     * This is `null` if the type is unknown or unsupported by Function.
     */
    type?: Dtype;
    /**
     * Parameter description.
     */
    description?: string;
    /**
     * Parameter is optional.
     */
    optional?: boolean;
    /**
     * Parameter value range for numeric parameters.
     */
    range?: [number, number];
    /**
     * Parameter value choices for enumeration parameters.
     */
    enumeration?: EnumerationMember[];
    /**
     * Parameter JSON schema.
     * This is only populated for `list` and `dict` parameters.
     */
    schema?: Record<string, any>;
}

/**
 * Prediction parameter enumeration member.
 */
export interface EnumerationMember {
    /**
     * Enumeration member name.
     */
    name: string;
    /**
     * Enumeration member value.
     */
    value: string | number;
}
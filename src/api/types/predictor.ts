/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import { Dtype } from "./dtype"
import { Feature, FeatureValue } from "./feature"
import { Profile } from "./profile"

/**
 * Predictor acceleration.
 */
export enum Acceleration {
    /**
     * Predictor is run on the CPU.
     */
    CPU = "CPU",
    /**
     * Predictor is run on an Nvidia A40 GPU.
     */
    A40 = "A40",
    /**
     * Predictor is run on an Nvidia A100 GPU.
     */
    A100 = "A100"
}

/**
 * Predictor access mode.
 */
export enum AccessMode {
    /**
     * Predictor can be viewed and loaded by anyone.
     */
    Public = "PUBLIC",
    /**
     * Predictor can only viewed and loaded by owner.
     */
    Private = "PRIVATE"
}

/**
 * Predictor status.
 */
export enum PredictorStatus {
    /**
     * Predictor is being provisioned.
     */
    Provisioning = "PROVISIONING",
    /**
     * Predictor is active.
     */
    Active = "ACTIVE",
    /**
     * Predictor is invalid.
     */
    Invalid = "INVALID",
    /**
     * Predictor is archived.
     */
    Archived = "ARCHIVED"
}

/**
 * Predictor type.
 */
export enum PredictorType {
    /**
     * Cloud predictor.
     */
    Cloud = "CLOUD",
    /**
     * Edge predictor.
     */
    Edge = "EDGE"
}

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
    owner: Profile;
    /**
     * Predictor name.
     */
    name: string;
    /**
     * Predictor name.
     */
    type: PredictorType;
    /**
     * Predictor status.
     */
    status: PredictorStatus;
    /**
     * Predictor access mode.
     */
    access: AccessMode;
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
     * Predictor readme.
     */
    readme?: string;
    /**
     * Predictor media URL.
     * We encourage animated GIF's where possible.
     */
    media?: string;
    /**
     * Predictor acceleration.
     * This only applies to `CLOUD` predictors.
     */
    acceleration?: Acceleration;
    /**
     * Predictor signature.
     */
    signature?: Signature;
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
 * This describes a feature that is consumed or produced by a predictor.
 */
export interface Parameter {
    /**
     * Parameter name.
     */
    name?: string;
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
     * Parameter default value.
     */
    defaultValue?: FeatureValue | Feature;
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
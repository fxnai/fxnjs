/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { GraphClient } from "./api"
import { EnvironmentVariableService, PredictionService, PredictorService, StorageService, UserService } from "./services"

export interface FunctionConfig {
    /**
     * Function access key.
     */
    accessKey?: string;
    /**
     * Function graph API URL.
     */
    url?: string;
}

/**
 * Function client.
 */
export class Function {

    /**
     * Graph API client.
     * Do NOT use this unless you know what you are doing.
     */
    public readonly client: GraphClient;

    /**
     * Manage users.
     */
    public readonly users: UserService;

    /**
     * Manage predictors.
     */
    public readonly predictors: PredictorService;

    /**
     * Make predictions.
     */
    public readonly predictions: PredictionService;

    /**
     * Manage predictor environment variables.
     */
    public readonly environmentVariables: EnvironmentVariableService;

    /**
     * Upload and download files.
     */
    public readonly storage: StorageService;

    /**
     * Create a Function client.
     * @param config Function client configuration.
     */
    public constructor (config?: FunctionConfig) {
        this.client = new GraphClient(config ?? { });
        this.users = new UserService(this.client);
        this.storage = new StorageService(this.client);
        this.predictors = new PredictorService(this.client);
        this.predictions = new PredictionService(this.client, this.storage);
        this.environmentVariables = new EnvironmentVariableService(this.client);
    }
}
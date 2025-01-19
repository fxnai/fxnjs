/*
*   Function
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import { BetaClient } from "./beta/client"
import { FunctionClient } from "./client"
import { PredictionService, PredictorService, UserService } from "./services"

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
    public readonly client: FunctionClient;

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
     * Beta client for incubating features.
     */
    public readonly beta: BetaClient;

    /**
     * Create a Function client.
     * @param config Function client configuration.
     */
    public constructor (config?: FunctionConfig) {
        this.client = new FunctionClient(config ?? { });
        this.users = new UserService(this.client);
        this.predictors = new PredictorService(this.client);
        this.predictions = new PredictionService(this.client);
        this.beta = new BetaClient(this.client);
    }
}
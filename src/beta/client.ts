/*
*   Function
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import { PredictionService } from "./prediction"
import type { FunctionClient } from "../client"

/**
 * Client for incubating features.
 */
export class BetaClient {

    /**
     * Make predictions.
     */
    public readonly predictions: PredictionService;

    public constructor (client: FunctionClient) {
        this.predictions = new PredictionService(client);
    }
}
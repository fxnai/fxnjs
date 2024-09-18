/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import type { FunctionAPIError, FunctionClient } from "../client"
import type { Predictor } from "../types"

export interface RetrievePredictorInput {
    /**
     * Predictor tag.
     */
    tag: string;
}

export class PredictorService {

    private readonly client: FunctionClient;

    public constructor (client: FunctionClient) {
        this.client = client;
    }

    /**
     * Retrieve a predictor.
     * @param input Input arguments.
     * @returns Predictor.
     */
    public async retrieve ({ tag }: RetrievePredictorInput): Promise<Predictor | null> {
        try {
            const predictor = await this.client.request<Predictor>({ path: `/predictors/${tag}` });
            return predictor;
        } catch (error: unknown) {
            if ((error as FunctionAPIError).status === 404)
                return null;
            throw error;
        }
    }
}
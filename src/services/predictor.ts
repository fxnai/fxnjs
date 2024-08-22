/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { GraphClient } from "../api"
import type { Predictor, PredictorStatus } from "../types"
import { PROFILE_FIELDS } from "./user"

export interface RetrievePredictorInput {
    /**
     * Predictor tag.
     */
    tag: string;
}

export interface ListPredictorsInput {
    /**
     * Predictor status.
     */
    status?: PredictorStatus;
    /**
     * Predictor owner username.
     */
    owner?: string;
    /**
     * Pagination offset.
     */
    offset?: number;
    /**
     * Pagination count.
     */
    count?: number;
}

export interface SearchPredictorsInput {
    /**
     * Search query.
     */
    query?: string;
    /**
     * Pagination offset.
     */
    offset?: number;
    /**
     * Pagination count.
     */
    count?: number;
}

export class PredictorService {

    private readonly client: GraphClient;

    public constructor (client: GraphClient) {
        this.client = client;
    }

    /**
     * Retrieve a predictor.
     * @param input Input arguments.
     * @returns Predictor.
     */
    public async retrieve (input: RetrievePredictorInput): Promise<Predictor> {
        const { data: { predictor } } = await this.client.query<{ predictor: Predictor }>({
            query: `query ($input: PredictorInput!) {
                predictor (input: $input) {
                    ${PREDICTOR_FIELDS}
                }
            }`,
            variables: { input }
        });
        return predictor;
    }

    /**
     * List my predictors.
     * @param input Input arguments.
     * @returns Predictors.
     */
    public async list (input?: ListPredictorsInput): Promise<Predictor[]> {
        const { owner: username, ...predictors } = input ?? { };
        const { data: { user } } = await this.client.query<{ user: { predictors: Predictor[] } }>({
            query: `query ($user: UserInput, $predictors: UserPredictorsInput) {
                user (input: $user) {
                    predictors (input: $predictors) {
                        ${PREDICTOR_FIELDS}
                    }
                }
            }`,
            variables: { user: username && { username }, predictors }
        });
        return user?.predictors ?? null;
    }

    /**
     * Search active predictors.
     * @param input Input arguments
     * @returns Predictors.
     */
    public async search (input?: SearchPredictorsInput): Promise<Predictor[]> {
        const { data: { predictors } } = await this.client.query<{ predictors: Predictor[] }>({
            query: `query ($input: PredictorsInput) {
                predictors (input: $input) {
                    ${PREDICTOR_FIELDS}
                }
            }`,
            variables: { input }
        });
        return predictors;
    }
}

export const PREDICTOR_FIELDS = `
tag
owner {
    ${PROFILE_FIELDS}
}
name
status
access
predictions
created
description
card
media
signature {
    inputs {
        name
        type
        description
        range
        optional
        enumeration {
            name
            value
        }
        defaultValue {
            data
            type
            shape
        }
        schema
    }
    outputs {
        name
        type
        description
        range
        optional
        enumeration {
            name
            value
        }
        defaultValue {
            data
            type
            shape
        }
        schema
    }
}
error
license
`;
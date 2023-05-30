/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import { GraphClient } from "../graph"
import { Acceleration, AccessMode, EnvironmentVariable, Predictor, PredictorStatus, PredictorType } from "../types"
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
    status: PredictorStatus;
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
    query: string;
    /**
     * Pagination offset.
     */
    offset?: number;
    /**
     * Pagination count.
     */
    count?: number;
}

export interface CreatePredictorInput {
    /**
     * Predictor tag.
     */
    tag: string;
    /**
     * Notebook URL.
     * This MUST be a `NOTEBOOK` upload URL.
     */
    notebook: string;
    /**
     * Predictor type.
     * This defaults to `CLOUD`.
     */
    type?: PredictorType;
    /**
     * Predictor access mode.
     * This defaults to `PUBLIC`.
     */
    access?: AccessMode;
    /**
     * Predictor acceleration.
     * This only applies for `CLOUD` predictors.
     * This defaults to `CPU`.
     */
    acceleration?: Acceleration;
    /**
     * Predictor environment variables.
     */
    environment?: EnvironmentVariable[];
    /**
     * Predictor description.
     * This supports Markdown.
     */
    description?: string;
    /**
     * Predictor media URL.
     */
    media?: string;
    /**
     * Predictor license URL.
     */
    license?: string;
    /**
     * Overwrite any existing predictor with the same tag.
     * Existing predictor will be deleted.
     */
    overwrite?: boolean;
}

export interface DeletePredictorInput {
    /**
     * Predictor tag.
     */
    tag: string;
}

export interface ArchivePredictorInput {
    /**
     * Predictor tag.
     */
    tag: string
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
        const { data: { predictor } } = await this.client.query<{ predictor: Predictor }>(
            `query ($input: PredictorInput!) {
                predictor (input: $input) {
                    ${PREDICTOR_FIELDS}
                }
            }`,
            { input }
        );
        return predictor;
    }

    /**
     * List my predictors.
     * @param input Input arguments.
     * @returns Predictors.
     */
    public async list (input?: ListPredictorsInput): Promise<Predictor[]> { // DEPLOY
        const { data: { user } } = await this.client.query<{ user: { predictors: Predictor[] } }>(
            `query ($input: PredictorOwnerPredictorsInput!) {
                user {
                    ... on User {
                        predictors (input: $input) {
                            ${PREDICTOR_FIELDS}
                        }
                    }
                }
            }`,
            { input: input ?? { } }
        );
        return user?.predictors;
    }

    /**
     * Search predictors.
     * @param input Input arguments
     * @returns Predictors.
     */
    public async search (input: SearchPredictorsInput): Promise<Predictor[]> {
        const { data: { predictors } } = await this.client.query<{ predictors: Predictor[] }>(
            `query ($input: PredictorsInput!) {
                predictors (input: $input) {
                    ${PREDICTOR_FIELDS}
                }
            }`,
            { input }
        );
        return predictors;
    }

    /**
     * Create a predictor.
     * @param input Input arguments.
     * @returns Predictor.
     */
    public async create (input: CreatePredictorInput): Promise<Predictor> {
        const { data: { predictor } } = await this.client.query<{ predictor: Predictor }>(
            `mutation ($input: CreatePredictorInput!) {
                predictor: createPredictor (input: $input) {
                    ${PREDICTOR_FIELDS}
                }
            }`,
            { input }
        );
        return predictor;
    }

    /**
     * Delete a predictor.
     * @param input Input arguments.
     * @returns Whether the predictor was successfully deleted.
     */
    public async delete (input: DeletePredictorInput): Promise<boolean> {
        const { data: { result } } = await this.client.query<{ result: boolean }>(
            `mutation ($input: DeletePredictorInput!) {
                result: deletePredictor (input: $input)
            }`,
            { input }
        );
        return result;
    }

    /**
     * Archive an active predictor.
     * @param input Input arguments.
     * @returns Archived predictor.
     */
    public async archive (input: ArchivePredictorInput): Promise<Predictor> {
        const { data: { predictor } } = await this.client.query<{ predictor: Predictor }>(
            `mutation ($input: ArchivePredictorInput!) {
                archivePredictor (input: $input) {
                    ${PREDICTOR_FIELDS}
                }
            }`,
            { input }
        );
        return predictor;
    }
}

export const PREDICTOR_FIELDS = `
tag
owner {
    ${PROFILE_FIELDS}
}
name
type
description
status
access
created
media
acceleration
signature {
    inputs {
        name
        type
        description
        range
        optional
        stringDefault
        floatDefault
        intDefault
        boolDefault
    }
    outputs {
        name
        type
        description
    }
}
license
`;
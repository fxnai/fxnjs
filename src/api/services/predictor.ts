/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import { GraphClient } from "../graph"
import { Acceleration, AccessMode, Predictor, PredictorStatus, PredictorType } from "../types"

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
     * Predictor type.
     */
    type: PredictorType;
    /**
     * Notebook URL.
     * This MUST be a `NOTEBOOK` upload URL.
     */
    notebook: string;
    /**
     * Predictor description.
     * This supports Markdown.
     */
    description?: string;
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
     * Predictor license.
     */
    license?: string;
    /**
     * Predictor topics.
     */
    topics?: string[];
    /**
     * Predictor media URL.
     */
    media?: string;
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
    private readonly FIELDS = `
    tag
    owner {
        username
        created
        name
        avatar
        bio
        website
        github
    }
    name
    description
    status
    access
    license
    topics
    created
    media
    `;

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
                    ${this.FIELDS}
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
                            ${this.FIELDS}
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
                    ${this.FIELDS}
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
                    ${this.FIELDS}
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
                    ${this.FIELDS}
                }
            }`,
            { input }
        );
        return predictor;
    }
}
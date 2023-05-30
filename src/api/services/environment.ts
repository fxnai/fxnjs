/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import { GraphClient } from "../graph"
import { EnvironmentVariable } from "../types"

export interface ListEnvironmentVariablesInput {
    /**
     * Organization username.
     * If `null` the current user's environment variables will be fetched.
     */
    organization?: string;
}

export interface CreateEnvironmentVariableInput {
    /**
     * Variable name.
     */
    name: string;
    /**
     * Variable value.
     */
    value: string;
    /**
     * Organization username.
     * Specify this when the environment variable is owned by an organization.
     */
    organization?: string;
}

export interface DeleteEnvironmentVariableInput {
    /**
     * Variable name.
     */
    name: string;
    /**
     * Organization username.
     * Specify this when the environment variable is owned by an organization.
     */
    organization?: string;
}

export class EnvironmentVariableService {

    private readonly client: GraphClient;

    public constructor (client: GraphClient) {
        this.client = client;
    }

    /**
     * List my global environment variables.
     * Note that environment variable values can only be viewed on Function (https://hub.fxn.ai).
     * @param input Input arguments.
     * @returns Environment variables.
     */
    public async list (input?: ListEnvironmentVariablesInput): Promise<EnvironmentVariable[]> { // DEPLOY
        const { data: { user } } = await this.client.query<{ user: { environmentVariables: EnvironmentVariable[] } }>(
            `query ($input: UserInput) {
                user (input: $input) {
                    ... on User {
                        environmentVariables (input: $input) {
                            name
                        }
                    }
                    ... on Organization {
                        environmentVariables (input: $input) {
                            name
                        }
                    }
                }
            }`,
            { input }
        );
        return user?.environmentVariables;
    }

    /**
     * Create a environment variable.
     * @param input Input arguments.
     * @returns Created environment variable.
     */
    public async create (input: CreateEnvironmentVariableInput): Promise<EnvironmentVariable> { // DEPLOY
        const { data: { environment } } = await this.client.query<{ environment: EnvironmentVariable }>(
            `mutation ($input: CreateEnvironmentVariableInput!) {
                environment: createEnvironmentVariable (input: $input) {
                    name
                }
            }`,
            { input }
        );
        return environment;
    }

    /**
     * Delete an environment variable.
     * @param input Input arguments.
     * @returns Whether environment variable was successfully deleted.
     */
    public async delete (input: DeleteEnvironmentVariableInput): Promise<boolean> { // DEPLOY
        const { data: { result } } = await this.client.query<{ result: boolean }>(
            `mutation ($input: DeleteEnvironmentVariableInput!) {
                result: deleteEnvironmentVariable (input: $input)
            }`,
            { input }
        );
        return result;
    }
}
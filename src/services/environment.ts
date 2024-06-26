/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { GraphClient } from "../api"
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
    public async list (input?: ListEnvironmentVariablesInput): Promise<EnvironmentVariable[]> {
        const { data: { user } } = await this.client.query<{ user: { environmentVariables: EnvironmentVariable[] } }>({
            query: `query ($input: UserInput) {
                user (input: $input) {
                    ... on User {
                        environmentVariables {
                            name
                        }
                    }
                    ... on Organization {
                        environmentVariables {
                            name
                        }
                    }
                }
            }`,
            variables: { input }
        });
        return user?.environmentVariables ?? null;
    }

    /**
     * Create a environment variable.
     * @param input Input arguments.
     * @returns Created environment variable.
     */
    public async create (input: CreateEnvironmentVariableInput): Promise<EnvironmentVariable> {
        const { data: { environment } } = await this.client.query<{ environment: EnvironmentVariable }>({
            query: `mutation ($input: CreateEnvironmentVariableInput!) {
                environment: createEnvironmentVariable (input: $input) {
                    name
                }
            }`,
            variables: { input }
        });
        return environment;
    }

    /**
     * Delete an environment variable.
     * @param input Input arguments.
     * @returns Whether environment variable was successfully deleted.
     */
    public async delete (input: DeleteEnvironmentVariableInput): Promise<boolean> {
        const { data: { result } } = await this.client.query<{ result: boolean }>({
            query: `mutation ($input: DeleteEnvironmentVariableInput!) {
                result: deleteEnvironmentVariable (input: $input)
            }`,
            variables: { input }
        });
        return result;
    }
}
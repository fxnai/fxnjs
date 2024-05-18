/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { FunctionConfig } from "../function"

export interface GraphPayload<T> {
    /**
     * Query result data.
     */
    data: T;
    /**
     * Response headers.
     */
    headers: Headers;
}

export interface QueryInput {
    /**
     * GraphQL query.
     */
    query: string;
    /**
     * Query variables.
     */
    variables?: { [key: string]: any };
    /**
     * Graph API URL override.
     */
    url?: string;
}

/**
 * Function graph API client.
 */
export class GraphClient {

    public readonly url: string;
    public readonly auth: string;
    public static readonly URL: string = "https://api.fxn.ai";

    /**
     * Create a Function graph API client.
     * @param config Function client configuration.
     */
    public constructor (config: FunctionConfig) {
        const { accessKey, url = GraphClient.URL } =  config;
        this.url = url;
        this.auth = accessKey ? `Bearer ${accessKey}` : null;
    }

    /**
     * Query the Function graph API.
     */
    public async query<T = any> ({ query, variables, url: urlOverride }: QueryInput): Promise<GraphPayload<T>> {
        // Request
        const url = urlOverride ?? `${this.url}/graph`;
        const response = await fetch(url, {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: this.auth },
            body: JSON.stringify({ query, variables })
        });
        const { data, errors } = await response.json();
        const headers = response.headers;
        // Check
        if (errors)
            throw new Error(errors[0].message);
        // Return
        return { data: data as T, headers };
    }
}
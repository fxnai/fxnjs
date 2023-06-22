/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

//import fetch from "cross-fetch"
import { FunctionConfig } from "../client"

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

/**
 * Function graph API client.
 */
export class GraphClient {

    private readonly url: string;
    private readonly auth: string

    /**
     * Create a Function graph API client.
     * @param config Function client configuration.
     */
    public constructor (config: FunctionConfig) {
        const { accessKey, url = "https://api.fxn.ai/graph" } =  config;
        this.url = url;
        this.auth = accessKey ? `Bearer ${accessKey}` : null;
    }
    
    /**
     * Query the Function graph API.
     * @param query Graph query.
     * @param variables Query variables.
     */
    public async query<T = any> (query: string, variables?: { [key: string]: any }): Promise<GraphPayload<T>> {
        // Request
        const response = await fetch(this.url, {
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
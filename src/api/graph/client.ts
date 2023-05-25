/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import axios, { AxiosResponseHeaders } from "axios"
import { FunctionConfig } from "../client"

interface GraphResponse<T> {
    data?: { [key: string]: T };
    errors?: { message: string; }[];
}

export interface GraphPayload<T> {
    /**
     * Query result data.
     */
    data: T;
    /**
     * Response headers.
     */
    headers: AxiosResponseHeaders;
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
        const { data: { data, errors }, headers } = await axios.post<GraphResponse<T>>(
            this.url,
            { query, variables },
            { headers: { Authorization: this.auth } }
        );
        // Check
        if (errors)
            throw new Error(errors[0].message);
        // Return
        return { data: data as T, headers };
    }
}
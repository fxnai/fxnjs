/*
*   Function
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { FunctionConfig } from "./function"

export interface RequestInput {
    /**
     * Request path.
     */
    path: string;
    /**
     * Request method.
     * Defaults to `GET`.
     */
    method?: string;
    /**
     * Request headers.
     */
    headers?: Record<string, string>;
    /**
     * Request body.
     */
    body?: Record<string, any>;
}

/**
 * Function API client.
 */
export class FunctionClient {

    /**
     * Function API URL.
     */
    public readonly url: string;

    private readonly auth: string;
    private static readonly URL: string = "https://api.fxn.ai/v1";

    /**
     * Create a Function API client.
     * @param config Function client configuration.
     */
    public constructor ({
        accessKey = process.env.FXN_ACCESS_KEY,
        url = process.env.FXN_API_URL ?? FunctionClient.URL
    }: FunctionConfig) {
        this.url = url;
        this.auth = accessKey != null ? `Bearer ${accessKey}` : "";
    }

    /**
     * Make a request to the Function API.
     */
    public async request<T = any> ({
        path,
        method = "GET",
        headers,
        body
    }: RequestInput): Promise<T> {
        const response = await fetch(
            `${this.url}${path}`,
            {
                method,
                headers: { ...headers, "Authorization": this.auth },
                body: body ? JSON.stringify(body) : undefined
            }
        );
        const payload = await response.json();
        if (!response.ok)
            throw new FunctionAPIError(
                payload?.errors?.[0].message ?? "An unknown error occurred",
                response.status
            );
        return payload;
    }
}

export class FunctionAPIError extends Error {

    /**
     * Request status code.
     */
    public readonly status: number;

    public constructor (message: string, status: number) {
        super(message);
        this.name = "FunctionAPIError";
        this.status = status;
        Error.captureStackTrace(this, this.constructor);
    }
}
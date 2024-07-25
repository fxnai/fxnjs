/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { decode, encode } from "base64-arraybuffer"
import { GraphClient } from "../api"
import type { UploadType } from "../types"

export interface CreateUploadURLInput {
    /**
     * File name.
     */
    name: string;
    /**
     * Upload type.
     */
    type: UploadType;
    /**
     * File key.
     * This is useful for grouping related files.
     */
    key?: string;
}

export interface UploadInput {
    /**
     * File name.
     */
    name: string;
    /**
     * Data to upload.
     */
    buffer: ArrayBuffer;
    /**
     * Upload type.
     */
    type: UploadType;
    /**
     * Mime type.
     */
    mime?: string;
    /**
     * Return a data URL if the provided buffer is smaller than this limit (in bytes).
     */
    dataUrlLimit?: number;
    /**
     * Upload key
     */
    key?: string;
}

export interface DownloadInput {
    /**
     * Download URL.
     */
    url: string;
}

export class StorageService {

    private readonly client: GraphClient;

    public constructor (client: GraphClient) {
        this.client = client;
    }

    /**
     * Create an upload URL.
     * @param input Input arguments.
     * @returns Upload URL.
     */
    public async createUploadUrl (input: CreateUploadURLInput): Promise<string> {
        const { data: { url } } = await this.client.query<{ url: string }>({
            query: `mutation ($input: CreateUploadUrlInput!) {
                url: createUploadUrl (input: $input)
            }`,
            variables: { input },
            url: `${GraphClient.URL}/graph`
        });
        return url;
    }

    /**
     * Upload data to Function.
     * @param input Input arguments.
     * @returns Uploaded file URL.
     */
    public async upload (input: UploadInput): Promise<string> {
        const { name, buffer, type, mime = "application/octet-stream", dataUrlLimit = 0, key } = input;
        // Handle data URL
        if (buffer.byteLength < dataUrlLimit)
            return `data:${mime};base64,${encode(buffer)}`;
        // Upload
        const url = await this.createUploadUrl({ name, type, key });
        await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": mime, "Content-Length": buffer.byteLength.toString() },
            body: buffer
        });
        // Return
        return url;
    }

    /**
     * Download data from Function.
     * @param input Input arguments.
     * @returns Array buffer.
     */
    public async download (input: DownloadInput): Promise<ArrayBuffer> {
        const { url } = input;
        // Handle data URL
        if (url.startsWith("data:")) {
            const b64Idx = url.indexOf(",");
            const b64 = url.substring(b64Idx + 1);
            return decode(b64);
        }
        // Download
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        return buffer;
    }
}
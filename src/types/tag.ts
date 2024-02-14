/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

/**
 * Predictor tag.
 */
export interface Tag {
    /**
     * Owner username.
     */
    username: string;
    /**
     * Predictor name.
     */
    name: string;
}

/**
 * Serialize a predictor tag.
 * @param tag Predictor tag.
 * @returns Serialized tag string.
 */
export function serializeTag (tag: Tag): string {
    return `@${tag.username}/${tag.name}`;
}

/**
 * Parse a predictor tag
 * @param params Serialized tag or tag request parameters.
 * @returns Parsed tag.
 */
export function parseTag (value: string): Tag {
    // Check
    if (!value)
        return null;
    // Split
    const [username, name] = value.toLowerCase().trim().slice(1).split("/");
    return { username, name };
}
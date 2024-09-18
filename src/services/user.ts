/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import type { FunctionAPIError, FunctionClient } from "../client"
import type { User } from "../types"

export class UserService {

    private readonly client: FunctionClient;

    public constructor (client: FunctionClient) {
        this.client = client;
    }

    /**
     * Retrieve a user.
     * @param input Input arguments. If `null` then this will retrieve the currently authenticated user.
     * @returns User.
     */
    public async retrieve (): Promise<User | null> {
        try {
            const user = await this.client.request<User>({ path: "/users" });
            return user;
        } catch (error: unknown) {
            if ((error as FunctionAPIError).status === 401)
                return null;
            throw error;
        }
    }
}
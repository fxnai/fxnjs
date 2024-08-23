/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { GraphClient } from "../api"
import type { User } from "../types"

export class UserService {

    private readonly client: GraphClient;

    public constructor (client: GraphClient) {
        this.client = client;
    }

    /**
     * Retrieve a user.
     * @param input Input arguments. If `null` then this will retrieve the currently authenticated user.
     * @returns User.
     */
    public async retrieve (): Promise<User> {
        const { data: { user } } = await this.client.query<{ user: User }>({
            query: `query ($input: UserInput) {
                user (input: $input) {
                    ${USER_FIELDS}
                }
            }`,
        });
        return user;
    }
}

const USER_FIELDS = `
username
name
avatar
bio
website
github
created
`;
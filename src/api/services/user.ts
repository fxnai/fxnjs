/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import { GraphClient } from "../graph"
import { Profile, User } from "../types"

export interface RetrieveUserInput {
    /**
     * Username.
     */
    username: string;
}

export interface UpdateUserInput {
    /**
     * User full name.
     */
    name?: string;
    /**
     * User bio.
     */
    bio?: string;
    /**
     * User avatar URL.
     */
    avatar?: string;
    /**
     * User website.
     */
    website?: string;
    /**
     * User GitHub handle.
     */
    github?: string;
    /**
     * Monthly spend limit.
     */
    spendLimit?: number;
}

export class UserService {

    private readonly client: GraphClient;

    public constructor (client: GraphClient) {
        this.client = client;
    }

    /**
     * Retrieve a user.
     * @param input Input arguments. If `null` then this will retrieve the currently authenticated user.
     * @returns User profile.
     */
    public async retrieve (input?: RetrieveUserInput): Promise<Profile | User> {
        const username = input?.username;
        const { data: { user } } = await this.client.query<{ user: Profile | User }>(
            `query ($input: UserInput) {
                user (input: $input) {
                    ${PROFILE_FIELDS}
                    ${username ? "" : USER_FIELDS}
                }
            }`,
            { input }
        );
        return user;
    }

    /**
     * Update a user profile.
     * @param input Input arguments.
     * @returns Updated user profile.
     */
    public async update (input: UpdateUserInput): Promise<User> {
        const { data: { user } } = await this.client.query<{ user: User }>(
            `mutation ($input: UpdateUserInput!) {
                user: updateUser (input: $input) {
                    ${PROFILE_FIELDS}
                    ${USER_FIELDS}
                }
            }`,
            { input }
        );
        return user;
    }
}

export const PROFILE_FIELDS = `
username
created
name
avatar
bio
website
github
`;

export const USER_FIELDS = `
email
`;
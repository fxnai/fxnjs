/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

/**
 * Function user profile.
 */
export interface Profile {
    /**
     * Function username.
     * This is always lowercase and uniquely identifies a user account.
     */
    username: string;
    /**
     * Date created.
     */
    created: Date;
    /**
     * Full name.
     */
    name?: string;
    /**
     * User avatar URL.
     */
    avatar?: string;
    /**
     * User bio.
     */
    bio?: string;
    /**
     * User website.
     */
    website?: string;
    /**
     * User GitHub.
     */
    github?: string;
}

/**
 * Function user.
 */
export interface User extends Profile {
    /**
     * User email address.
     */
    email: string;
}
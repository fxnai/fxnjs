/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

/**
 * Function user.
 */
export interface User {
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
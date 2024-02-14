/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { Profile } from "./profile"

/**
 * Function user.
 */
export interface User extends Profile {
    /**
     * User email address.
     */
    email: string;
}
/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import mocha from "@testdeck/mocha"
import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import { randomBytes } from "crypto"
import { Function, User } from "../src"

@mocha.suite("Users")
class UserTest {

    private fxn: Function;

    public before () {
        should();
        use(chaiAsPromised);
        this.fxn = new Function({ accessKey: process.env.ACCESS_KEY, url: process.env.API_URL });
    }

    @mocha.test
    async "Should retrieve the current authed user" () {
        const user = await this.fxn.users.retrieve() as User;
        expect(user.email).to.not.be.undefined;
        expect(user.username).to.equal("yusuf");
    }

    @mocha.test
    async "Should retrieve a user profile" () {
        const username = "natsuite";
        const user = await this.fxn.users.retrieve({ username }) as User; // this is a `Profile`
        expect(user.email).to.be.undefined;
        expect(user.username).to.equal(username);
    }

    @mocha.test
    async "Should update the current user's profile" () {
        const bio = randomBytes(100).toString("hex");
        const user = await this.fxn.users.update({ bio });
        expect(user.bio).to.equal(bio);
        expect(user.email).to.not.be.undefined;
    }
}
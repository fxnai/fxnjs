/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import mocha from "@testdeck/mocha"
import { Function, type User } from "../src"

@mocha.suite("Users")
class UserTest {

    private fxn: Function;

    public before () {
        should();
        use(chaiAsPromised);
        this.fxn = new Function();
    }

    @mocha.test
    async "Should retrieve the current user" () {
        const user = await this.fxn.users.retrieve();
        expect(user?.username).to.equal("yusuf");
    }

    @mocha.test
    async "Should retrieve no user" () {
        const fxn = new Function({ accessKey: "", url: process.env.FXN_API_URL });
        const user = await fxn.users.retrieve();
        expect(user).to.be.null;
    }
}
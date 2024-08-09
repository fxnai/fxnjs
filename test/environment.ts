/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import mocha from "@testdeck/mocha"
import { Function } from "../src"

@mocha.suite("Environment Variables")
class EnvironmentVariableTest {

    private fxn: Function;

    public before () {
        should();
        use(chaiAsPromised);
        this.fxn = new Function({
            accessKey: process.env.FXN_ACCESS_KEY,
            url: process.env.FXN_API_URL
        });
    }

    @mocha.test
    async "Should list the user's environment variables" () {
        const variables = await this.fxn.environmentVariables.list();
        expect(variables.length).to.greaterThan(0);
    }

    @mocha.test
    async "Should create and delete an environment variable" () {
        // Create
        const name = "APP_NAME";
        const variable = await this.fxn.environmentVariables.create({
            name,
            value: "Function"
        });
        expect(variable.name).to.equal("APP_NAME");
        expect(variable.value).to.be.undefined;
        // Delete
        const deleted = await this.fxn.environmentVariables.delete({ name });
        expect(deleted).to.be.true;
    }
}
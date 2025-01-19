/*
*   Function
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import mocha from "@testdeck/mocha"
import { Function } from "../src"

@mocha.suite("Predictors")
class PredictorTest {

    private fxn: Function;

    public before () {
        should();
        use(chaiAsPromised);
        this.fxn = new Function();
    }

    @mocha.test
    async "Should retrieve a predictor" () {
        const tag = "@yusuf/identity";
        const predictor = await this.fxn.predictors.retrieve({ tag });
        expect(predictor?.tag).to.equal(tag);
    }

    @mocha.test
    async "Should retrieve a non-existent predictor" () {
        const predictor = await this.fxn.predictors.retrieve({ tag: "@yusuf/404" });
        expect(predictor).to.be.null;
    }
}
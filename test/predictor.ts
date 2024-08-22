/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
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
        this.fxn = new Function({
            accessKey: process.env.FXN_ACCESS_KEY,
            url: process.env.FXN_API_URL
        });
    }

    @mocha.test
    async "Should retrieve a valid predictor" () {
        const tag = "@yusuf/identity";
        const predictor = await this.fxn.predictors.retrieve({ tag });
        expect(predictor.tag).to.equal(tag);
    }

    @mocha.test
    async "Should list predictors owned by user" () {
        const predictors = await this.fxn.predictors.list();
        expect(predictors.length).to.greaterThan(0);
    }

    @mocha.test
    async "Should search active predictors" () {
        const predictors = await this.fxn.predictors.search();
        expect(predictors.length).to.greaterThan(0);
    }
}
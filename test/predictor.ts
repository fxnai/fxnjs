/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import mocha from "@testdeck/mocha"
import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import { Function, PredictorType } from "../src"

@mocha.suite("Predictors")
class PredictorTest {

    private fxn: Function;

    public before () {
        should();
        use(chaiAsPromised);
        this.fxn = new Function({ accessKey: process.env.ACCESS_KEY, url: process.env.API_URL });
    }

    @mocha.test
    async "Should retrieve a valid predictor" () {
        const tag = "@natml/identity";
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

    @mocha.test
    async "Should create a predictor" () {
        const tag = "@natml/js-test";
        const type = PredictorType.Cloud;
        const notebook = "https://fxnai.s3.amazonaws.com/notebooks/05d441948f1da5f2b49a1c/identity.ipynb";
        const predictor = await this.fxn.predictors.create({ tag, type, notebook });
        expect(predictor.tag).to.equal(tag);
    }

    @mocha.test
    async "Should delete a predictor" () {
        const tag = "@natml/js-test";
        const deleted = await this.fxn.predictors.delete({ tag });
        expect(deleted).to.be.true;
    }
}
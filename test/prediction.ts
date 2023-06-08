/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import mocha from "@testdeck/mocha"
import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import { CloudPrediction, Function } from "../src"

@mocha.suite("Predictions")
class PredictionTest {

    private fxn: Function;

    public before () {
        should();
        use(chaiAsPromised);
        this.fxn = new Function({ accessKey: process.env.ACCESS_KEY, url: process.env.API_URL });
    }

    @mocha.test
    async "Should create a cloud prediction" () {
        const tag = "@natml/identity";
        const inputs = { name: "Yusuf", age: 24 };
        const prediction = await this.fxn.predictions.create({ tag, inputs }) as CloudPrediction;
        const results = prediction.results;
        expect(results?.[0]).to.equal(`Yusuf`)
        expect(results?.[1]).to.equal(24);
    }
}
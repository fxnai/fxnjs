/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import mocha from "@testdeck/mocha"
import { Prediction, Function } from "../src"

@mocha.suite("Predictions")
class PredictionTest {

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
    async "Should create a prediction" () {
        const prediction = await this.fxn.predictions.create({
            tag: "@yusuf/area",
            inputs: { radius: 4 }
        });
        const results = prediction.results;
        expect(results).to.not.be.empty;
    }

    @mocha.test.skip
    async "Should stream a prediction" () {
        const sentence = "Hello world";
        const stream = await this.fxn.predictions.stream({
            tag: "@yusuf/streaming",
            inputs: { sentence }
        });
        const predictions: Prediction[] = [];
        for await (const prediction of stream)
            predictions.push(prediction);
        expect(predictions.length).greaterThan(1);
    }
}
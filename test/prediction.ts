/*
*   Function
*   Copyright © 2023 NatML Inc. All Rights Reserved.
*/

import mocha from "@testdeck/mocha"
import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import { Prediction, Function } from "../src"

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
        const tag = "@yusuf/identity";
        const inputs = {
            name: "Yusuf",
            age: 24,
            ratio: 3.14159,
            option: false,
            choices: [true, false, true, true, false],
            numbers: [12, 38, 4, 102, 99],
            fractions: [4.2, 9.3, 1.3],
            names: ["Drake", "Josh", "Andy"],
            properties: {
                length: 12,
                height: 44,
                width: 3.9
            }
        };
        const prediction = await this.fxn.predictions.create({ tag, inputs });
        const results = prediction.results;
        expect(results?.[0]).to.equal(`Yusuf`)
        expect(results?.[1]).to.equal(24);
    }

    @mocha.test
    async "Should stream a cloud prediction" () {
        const sentence = "Hello world";
        const stream = await this.fxn.predictions.stream({
            tag: "@yusuf-delete/streaming",
            inputs: { sentence }
        });
        const predictions: Prediction[] = [];
        for await (const prediction of stream)
            predictions.push(prediction);
        expect(predictions.length).greaterThan(1);
    }
}
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
        this.fxn = new Function({
            accessKey: process.env.ACCESS_KEY!,
            url: process.env.API_URL
        });
    }

    @mocha.test
    async "Should create a cloud prediction" () {
        const tag = "@natml/discord-test@json";
        const inputs = { name: "Yusuf" };
        const prediction = await this.fxn.predictions.create({ tag, inputs }) as CloudPrediction;
        const result = prediction.results?.[0] as { name: string, age: number };
        expect(result.name).to.equal(`Yusuf`)
        expect(result.age).to.equal(24);
    }
}
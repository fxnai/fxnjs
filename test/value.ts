/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import mocha from "@testdeck/mocha"
import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import { Function, toFunctionValue, toPlainValue, StorageService, Tensor } from "../src"

@mocha.suite("Values")
class ValueTest {

    private fxn: Function;

    public before () {
        should();
        use(chaiAsPromised);
        this.fxn = new Function({ accessKey: process.env.ACCESS_KEY, url: process.env.API_URL });
    }

    @mocha.test
    async "Should rountrip Function value from float value" () {
        const input = 83.39;
        const value = await toFunctionValue({ value: input, name: "tensor", storage: this.fxn.storage, minUploadSize: 4096 });
        expect(value.type).to.equal("float32");
        const output = await toPlainValue({ value });
        expect(output).to.approximately(input, 1e-6);
    }

    @mocha.test
    async "Should rountrip Function value from float vector" () {
        const vector = new Float64Array([1.2, 3.3, 25, 8]);
        const value = await toFunctionValue({ value: vector, name: "vector", storage: this.fxn.storage, minUploadSize: 4096 });
        expect(value.type).to.equal("float64");
        const output = await toPlainValue({ value }) as Float64Array;
        expect(Array.from(output)).to.eql(Array.from(vector));
    }

    @mocha.test
    async "Should rountrip Function value from float tensor" () {
        const data = new Float32Array([1.2, 3.3, 25, 8]);
        const tensor: Tensor = { data, shape: [2, 2] };
        const value = await toFunctionValue({ value: tensor, name: "tensor", storage: this.fxn.storage, minUploadSize: 4096 });
        expect(value.type).to.equal("float32");
        const output = await toPlainValue({ value }) as Tensor;
        expect(Array.from(data)).to.eql(Array.from(output.data as Float32Array));
        expect(tensor.shape).to.eql(output.shape);
    }

    @mocha.test
    async "Should rountrip Function value from int value" () {
        const input = 22_050;
        const value = await toFunctionValue({ value: input, name: "tensor", storage: this.fxn.storage, minUploadSize: 4096 });
        expect(value.type).to.equal("int32");
        const output = await toPlainValue({ value }) as Float32Array;
        expect(output).to.eql(input);
    }

    @mocha.test
    async "Should rountrip Function value from int vector" () {
        const input = new Int16Array([249, 23_293, 990, -31_000]);
        const value = await toFunctionValue({ value: input, name: "tensor", storage: this.fxn.storage, minUploadSize: 4096 });
        expect(value.type).to.equal("int16");
        const output = await toPlainValue({ value }) as Int16Array
        expect(Array.from(output)).to.eql(Array.from(input));
    }

    @mocha.test
    async "Should rountrip Function value from int tensor" () {
        const data = new Int32Array([283, -1309, 1032, 19201, 3, 99]);
        const tensor: Tensor = { data, shape: [3, 2] };
        const value = await toFunctionValue({ value: tensor, name: "tensor", storage: this.fxn.storage, minUploadSize: 4096 });
        expect(value.type).to.equal("int32");
        const output = await toPlainValue({ value }) as Tensor;
        expect(Array.from(data)).to.eql(Array.from(output.data as Float32Array));
        expect(tensor.shape).to.eql(output.shape);
    }

    @mocha.test
    async "Should rountrip Function value from bool value" () {
        const input = true;
        const value = await toFunctionValue({ value: input, name: "tensor", storage: this.fxn.storage, minUploadSize: 4096 });
        expect(value.type).to.equal("bool");
        const output = await toPlainValue({ value });
        expect(output).to.eql(input);
    }

    @mocha.test
    async "Should rountrip Function value from bool array" () {
        const input = [false, true, true, false];
        const value = await toFunctionValue({ value: input, name: "tensor", storage: this.fxn.storage, minUploadSize: 4096 });
        expect(value.type).to.equal("bool");
        const output = await toPlainValue({ value }) as boolean[];
        expect(output).to.eql(input);
    }
}
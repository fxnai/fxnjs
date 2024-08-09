/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { createCanvas, loadImage } from "canvas"
import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import mocha from "@testdeck/mocha"
import { Function, isFunctionValue, BoolArray, type Image, type Tensor } from "../src"

@mocha.suite("Values")
class ValueTest {

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
    async "Should rountrip Function value from float scalar" () {
        const input = 83.39;
        const value = await this.fxn.predictions.toValue({ value: input, name: "tensor", minUploadSize: 4096 });
        expect(value.type).to.equal("float32");
        const output = await this.fxn.predictions.toObject({ value });
        expect(output).to.approximately(input, 1e-6);
    }

    @mocha.test
    async "Should rountrip Function value from float vector" () {
        const vector = new Float64Array([1.2, 3.3, 25, 8]);
        const value = await this.fxn.predictions.toValue({ value: vector, name: "vector", minUploadSize: 4096 });
        expect(value.type).to.equal("float64");
        const output = await this.fxn.predictions.toObject({ value }) as Tensor;
        expect(Array.from(output.data as Float64Array)).to.eql(Array.from(vector));
    }

    @mocha.test
    async "Should rountrip Function value from float tensor" () {
        const data = new Float32Array([1.2, 3.3, 25, 8]);
        const tensor: Tensor = { data, shape: [2, 2] };
        const value = await this.fxn.predictions.toValue({ value: tensor, name: "tensor", minUploadSize: 4096 });
        expect(value.type).to.equal("float32");
        const output = await this.fxn.predictions.toObject({ value }) as Tensor;
        expect(Array.from(data)).to.eql(Array.from(output.data as Float32Array));
        expect(tensor.shape).to.eql(output.shape);
    }

    @mocha.test
    async "Should rountrip Function value from int scalar" () {
        const input = 22_050;
        const value = await this.fxn.predictions.toValue({ value: input, name: "tensor", minUploadSize: 4096 });
        expect(value.type).to.equal("int32");
        const output = await this.fxn.predictions.toObject({ value }) as Float32Array;
        expect(output).to.eql(input);
    }

    @mocha.test
    async "Should rountrip Function value from int vector" () {
        const input = new Int16Array([249, 23_293, 990, -31_000]);
        const value = await this.fxn.predictions.toValue({ value: input, name: "tensor", minUploadSize: 4096 });
        expect(value.type).to.equal("int16");
        const output = await this.fxn.predictions.toObject({ value }) as Tensor
        expect(Array.from(output.data as Int16Array)).to.eql(Array.from(input));
        expect(output.shape).to.eql([input.length]);
    }

    @mocha.test
    async "Should rountrip Function value from int tensor" () {
        const data = new Int32Array([283, -1309, 1032, 19201, 3, 99]);
        const tensor: Tensor = { data, shape: [3, 2] };
        const value = await this.fxn.predictions.toValue({ value: tensor, name: "tensor", minUploadSize: 4096 });
        expect(value.type).to.equal("int32");
        const output = await this.fxn.predictions.toObject({ value }) as Tensor;
        expect(Array.from(data)).to.eql(Array.from(output.data as Float32Array));
        expect(tensor.shape).to.eql(output.shape);
    }

    @mocha.test
    async "Should rountrip Function value from bool scalar" () {
        const input = true;
        const value = await this.fxn.predictions.toValue({ value: input, name: "tensor", minUploadSize: 4096 });
        expect(value.type).to.equal("bool");
        const output = await this.fxn.predictions.toObject({ value });
        expect(output).to.eql(input);
    }

    @mocha.test
    async "Should rountrip Function value from bool vector" () {
        const input = new BoolArray([false, true, true, false]);
        const value = await this.fxn.predictions.toValue({ value: input, name: "tensor", minUploadSize: 4096 });
        expect(value.type).to.equal("bool");
        const output = await this.fxn.predictions.toObject({ value }) as Tensor;
        expect(Array.from(output.data as BoolArray)).to.eql(Array.from(input.map(i => +i)));
        expect(output.shape).to.eql([input.length]);
    }

    @mocha.test
    async "Should roundtrip Function value from image" () {
        const image = await ValueTest.loadImageDataFromPath("test/media/cat_224.jpg");
        const value = await this.fxn.predictions.toValue({
            value: image,
            name: "image",
            minUploadSize: image.data.byteLength + 1
        });
        expect(value.type).to.equal("image");
        const output = await this.fxn.predictions.toObject({ value }) as Image;
        expect(output.width).to.eql(image.width);
        expect(output.height).to.eql(image.height);
        expect(output.channels).to.eql(image.channels);
    }

    @mocha.test
    async "Should roundtrip Function value from null" () {
        const value = { type: "null" as const };
        expect(isFunctionValue(value)).to.be.true;
        expect(this.fxn.predictions.toObject({ value }) === null);
    }

    static async loadImageDataFromPath (path: string): Promise<Image> {
        const image = await loadImage(path);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, image.width, image.height);
        const { data, width, height } = ctx.getImageData(0, 0, image.width, image.height) as ImageData;
        return { data, width, height, channels: 4 };
    }
}
/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { createCanvas, loadImage } from "canvas"
import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import mocha from "@testdeck/mocha"
import { Function, Tensor } from "../src"

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
        const output = await this.fxn.predictions.toObject({ value }) as Float64Array;
        expect(Array.from(output)).to.eql(Array.from(vector));
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
    async "Should rountrip Function value from int value" () {
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
        const output = await this.fxn.predictions.toObject({ value }) as Int16Array
        expect(Array.from(output)).to.eql(Array.from(input));
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
    async "Should rountrip Function value from bool value" () {
        const input = true;
        const value = await this.fxn.predictions.toValue({ value: input, name: "tensor", minUploadSize: 4096 });
        expect(value.type).to.equal("bool");
        const output = await this.fxn.predictions.toObject({ value });
        expect(output).to.eql(input);
    }

    @mocha.test
    async "Should rountrip Function value from bool array" () {
        const input = [false, true, true, false];
        const value = await this.fxn.predictions.toValue({ value: input, name: "tensor", minUploadSize: 4096 });
        expect(value.type).to.equal("bool");
        const output = await this.fxn.predictions.toObject({ value }) as boolean[];
        expect(output).to.eql(input);
    }

    @mocha.test
    async "Should create prediction on image value" () {
        const imageData = await loadImageDataFromPath("test/media/cat_224.jpg");
        const value = await this.fxn.predictions.toValue({ value: imageData, name: "image" });
        expect(value.type).to.equal("image");
        const output = await this.fxn.predictions.toObject({ value }) as ImageData;
        expect(output.width).to.eql(imageData.width);
        expect(output.height).to.eql(imageData.height);
    }
}

async function loadImageDataFromPath (path: string): Promise<ImageData> {
    const image = await loadImage(path);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, image.width, image.height);
    return ctx.getImageData(0, 0, image.width, image.height) as ImageData;
}
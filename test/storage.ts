/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import mocha from "@testdeck/mocha"
import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import { decode } from "base64-arraybuffer"
import { readFileSync } from "fs"
import { Function, UploadType } from "../src"

@mocha.suite("Storage")
class StorageTest {

    private fxn: Function;

    public before () {
        should();
        use(chaiAsPromised);
        this.fxn = new Function({ accessKey: process.env.ACCESS_KEY, url: process.env.API_URL });
    }

    @mocha.test
    async "Should create upload URL" () {
        const name = "stablediffusion.ipynb";
        const type = UploadType.Notebook;
        const url = await this.fxn.storage.createUploadUrl({ name, type });
        expect(url).to.not.be.null;
    }

    @mocha.test
    async "Should create upload URL regardless of proxying" () {
        const name = "stablediffusion.ipynb";
        const type = UploadType.Notebook;
        const fxn = new Function({ url: "https://www.google.com" });
        const url = await fxn.storage.createUploadUrl({ name, type });
        expect(url).to.not.be.null;
    }

    @mocha.test
    async "Should create data URL" () {
        const fileBuffer = readFileSync("test/media/cat_224.jpg");
        // Create data URL
        const name = "cat.jpg";
        const type = UploadType.Media;
        const buffer = fileBuffer.buffer;
        const dataUrlLimit = 4 * 1024 * 1024;
        const url = await this.fxn.storage.upload({ name, buffer, type, dataUrlLimit });
        // Check
        expect(url.startsWith("data:")).to.be.true;
        const b64Idx = url.indexOf(",");
        const b64 = url.substring(b64Idx + 1);
        const b64Data = Buffer.from(decode(b64));
        expect(fileBuffer.equals(b64Data)).to.be.true;
    }

    @mocha.test
    async "Should upload file" () {
        const name = "cat.jpg";
        const type = UploadType.Media;
        const buffer = readFileSync("test/media/cat_224.jpg").buffer;
        const url = await this.fxn.storage.upload({ name, buffer, type });
        expect(url.startsWith("https://")).to.be.true;
    }

    @mocha.test
    async "Should decode data URL" () {
        const fileBuffer = readFileSync("test/media/cat_224.jpg");
        // Create data URL
        const name = "cat.jpg";
        const type = UploadType.Media;
        const buffer = fileBuffer.buffer;
        const dataUrlLimit = 4 * 1024 * 1024;
        const url = await this.fxn.storage.upload({ name, buffer, type, dataUrlLimit });
        // Decode and check
        const downloadBuffer = await this.fxn.storage.download({ url });
        expect(fileBuffer.equals(Buffer.from(downloadBuffer))).to.be.true;
    }

    @mocha.test
    async "Should download file" () {
        const fileBuffer = readFileSync("test/media/cat_224.jpg");
        const url = "https://cdn.natml.ai/media/3e9e6c7a2fa114156c8b5f/cat.jpg";
        const downloadBuffer = await this.fxn.storage.download({ url });
        expect(fileBuffer.equals(Buffer.from(downloadBuffer))).to.be.true;
    }
}
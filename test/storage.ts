/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { decode } from "base64-arraybuffer"
import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import { readFileSync } from "fs"
import mocha from "@testdeck/mocha"
import { Function, type UploadType } from "../src"

@mocha.suite("Storage")
class StorageTest {

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
    async "Should create upload URL" () {
        const name = "stablediffusion.ipynb";
        const url = await this.fxn.storage.createUploadUrl({ name, type: "NOTEBOOK" });
        expect(url).to.not.be.null;
    }

    @mocha.test
    async "Should create upload URL regardless of proxying" () {
        const name = "stablediffusion.ipynb";
        const fxn = new Function({ url: "https://www.google.com" });
        const url = await fxn.storage.createUploadUrl({ name, type: "NOTEBOOK" });
        expect(url).to.not.be.null;
    }

    @mocha.test
    async "Should create data URL" () {
        const fileBuffer = readFileSync("test/media/cat_224.jpg");
        // Create data URL
        const name = "cat.jpg";
        const buffer = fileBuffer.buffer;
        const dataUrlLimit = 4 * 1024 * 1024;
        const url = await this.fxn.storage.upload({ name, buffer, type: "MEDIA", dataUrlLimit });
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
        const buffer = readFileSync("test/media/cat_224.jpg").buffer;
        const url = await this.fxn.storage.upload({ name, buffer, type: "MEDIA" });
        expect(url.startsWith("https://")).to.be.true;
    }

    @mocha.test
    async "Should decode data URL" () {
        const fileBuffer = readFileSync("test/media/cat_224.jpg");
        // Create data URL
        const name = "cat.jpg";
        const buffer = fileBuffer.buffer;
        const dataUrlLimit = 4 * 1024 * 1024;
        const url = await this.fxn.storage.upload({ name, buffer, type: "MEDIA", dataUrlLimit });
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
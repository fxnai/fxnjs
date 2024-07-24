/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { FXNC } from "./types"

const FXNC_VERSION = "0.0.25";
const FXNC_LIB_URL_BASE = `https://cdn.fxn.ai/fxnc/${FXNC_VERSION}`;
let fxnc: FXNC = undefined;

const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";

export async function getFxnc (): Promise<FXNC> {
    // Check loaded
    if (fxnc)
        return fxnc;
    // Check env
    if (!isBrowser)
        return null;
    // Load
    fxnc = await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `${FXNC_LIB_URL_BASE}/Function.js`;
        script.onerror = error => reject(`Function Error: Failed to load Function implementation for in-browser predictions with error: ${error}`);
        script.onload = async () => {
            // Get loader
            const name = "__fxn";
            const locateFile = (path: string) => path === "Function.wasm" ? `${FXNC_LIB_URL_BASE}/Function.wasm` : path;
            const moduleLoader = (window as any)[name];
            (window as any)[name] = null;
            // Load
            try {
                const fxnc = await moduleLoader({ locateFile });
                resolve(fxnc);
            } catch (error) {
                reject(`Function Error: Failed to load Function implementation for in-browser predictions with error: ${error}`);
            } finally {
                script.remove();
            }
        };
        document.body.appendChild(script);
    });
    // Return
    return fxnc;
}
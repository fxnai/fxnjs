/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import https from "https"
import { createWriteStream, promises as fsPromises } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const { writeFile, mkdir } = fsPromises;

function getPlatformId () {
  switch (process.platform) {
    case "darwin":  return "macos";
    case "linux":   return "linux";
    case "win32":   return "win";
    default:        throw new Error(`Function Error: Cannot retrieve platform identifier because current platform is not supported: ${process.platform}`);
  }
}

function getArchId () {
  switch (process.arch) {
    case "arm64":   return "arm64";
    case "x64":     return "x86_64";
    default:        throw new Error(`Function Error: Cannot generate architecture identifier because current architecture is not supported: ${process.arch}`);
  }
}

function getFxnodeUrl () {
  const FXNODE_VERSION = "0.0.1";        
  return `https://cdn.fxn.ai/fxnode/${FXNODE_VERSION}/Function-${getPlatformId()}-${getArchId()}.node`;
}

function getFxncUrl () {
  const FXNC_VERSION = "0.0.25";
  const suffix = { darwin: ".dylib", linux: ".so", win32: ".dll" }[process.platform] ?? "";
  const base = process.platform === "linux" ? "libFunction" : "Function";
  return `https://cdn.fxn.ai/fxnc/${FXNC_VERSION}/${base}-${getPlatformId()}-${getArchId()}${suffix}`;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const fxnodeUrl = getFxnodeUrl();
const fxncUrl = getFxncUrl();
const libDir = join(__dirname, "..", "lib");
const fxncPath = join(libDir, "Function.node");
const fxnodePath = join(libDir, "Function.node");

// Download
await mkdir(libDir, { recursive: true });

console.log(addonUrl);
console.log(libUrl)
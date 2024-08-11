/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import axios from "axios"
import chalk from "chalk"
import { promises as fsPromises } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
const { writeFile, mkdir } = fsPromises;

const FXNC_VERSION = "0.0.26";
const FXNODE_VERSION = "0.0.2"; 

function getPlatformId () {
  switch (process.platform) {
    case "darwin":  return "macos";
    case "linux":   return "linux";
    case "win32":   return "win";
    default:        return "unknown";
  }
}

function getArchId () {
  switch (process.arch) {
    case "arm64":   return "arm64";
    case "x64":     return "x86_64";
    default:        return "unknown";
  }
}

function getFxncUrl () {
  const suffix = { darwin: ".dylib", linux: ".so", win32: ".dll" }[process.platform] ?? "";
  const base = process.platform === "linux" ? "libFunction" : "Function";
  return `https://cdn.fxn.ai/fxnc/${FXNC_VERSION}/${base}-${getPlatformId()}-${getArchId()}${suffix}`;
}

function getFxncName () {
  switch (process.platform) {
    case "darwin":  return "Function.dylib";
    case "win32":   return "Function.dll";
    default:        return "libFunction.so";
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const fxnodeUrl = `https://cdn.fxn.ai/fxnode/${FXNODE_VERSION}/Function-${getPlatformId()}-${getArchId()}.node`;
const fxncUrl = getFxncUrl();
const libDir = join(__dirname, "..", "lib");
const fxncPath = join(libDir, getFxncName());
const fxnodePath = join(libDir, "Function.node");

try {
  const fxncResponse = await axios({ url: fxncUrl, method: "GET", responseType: "arraybuffer" });
  const fxnodeResponse = await axios({ url: fxnodeUrl, method: "GET", responseType: "arraybuffer" });
  await mkdir(libDir, { recursive: true });
  await writeFile(fxncPath, fxncResponse.data);
  await writeFile(fxnodePath, fxnodeResponse.data);
} catch (e) {
  console.error(chalk.redBright(`Function Error: Failed to download library from '${e.config.url}' with error: ${e.message}. Edge predictions will fail.`));
}
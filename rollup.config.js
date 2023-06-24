import commonjs from "@rollup/plugin-commonjs"
import json from "@rollup/plugin-json"
import resolve from "@rollup/plugin-node-resolve"
import terser from "@rollup/plugin-terser"

const config = {
  input: "build/lib/index.js",
  output: {
    file: "build/umd/fxn.js",
    format: "umd",
    name: "fxnjs",
  },
  plugins: [
    commonjs(),
    resolve(),
    json(),
    //terser()
  ],
};

export default config;
# Function for JavaScript

![function logo](https://raw.githubusercontent.com/fxnai/.github/main/logo_wide.png)

Run AI prediction functions (a.k.a "predictors") in the browser and Node.js. With Function, you can build AI-powered apps by creating and composing GPU-accelerated predictors that run in the cloud. In a few steps:

## Installing Function
Function is distributed on NPM. Open a terminal and run the following command:
```bash
npm install fxnjs
```

## Retrieving your Access Key
Head over to [fxn.ai](https://fxn.ai) to create an account by logging in. Once you do, generate an access key:

![generate access key](https://raw.githubusercontent.com/fxnai/.github/main/access_key.gif)

## Making a Prediction
First, create a Function client and specify your access key:
```js
import { Function } from "fxnjs"

// Create a Function client
const fxn = new Function({ accessKey: "<ACCESS KEY>" });
```

Then make a prediction:
```js
// Make a prediction
const prediction = await fxn.predictions.create({
    tag: "@natml/greeting-sample",
    inputs: {
        name: "Rhea"
    }
});
// Log the result
console.log(prediction.results[0]);
```

___

## Useful Links
- [Discover predictors to use in your apps](https://fxn.ai/explore).
- [Join our Discord community](https://fxn.ai/community).
- [Check out our docs](https://docs.fxn.ai).
- Learn more about us [on our blog](https://blog.fxn.ai).
- Reach out to us at [hi@fxn.ai](mailto:hi@fxn.ai).

Function is a product of [NatML Inc](https://github.com/natmlx).
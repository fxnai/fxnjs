## 0.0.23
+ Added experimental support for running on-device predictions in the browser with WebAssembly!
+ Added `fxn.predictions.delete` method to delete a loaded edge predictor from memory.
+ Added `bigint` support for prediction inputs and outputs.
+ Fixed `fxn.predictions.create` wrongly returning scalar result for single-element vector output.
+ Fixed `fxn.predictors.list` returning `null` when listing organization predictors.
+ Removed `CloudPrediction` interface. Use `Prediction` interface instead.
+ Removed `EdgePrediction` interface. Use `Prediction` interface instead.

## 0.0.22
+ Added `AccessMode.Protected` enumeration member for working with protected predictors.

## 0.0.21
+ Added `Function.predictions.stream` method to create a streaming prediction.

## 0.0.20
+ Added `Parameter.schema` field for inspecting the JSON schema for `dict` and `list` parameters.

## 0.0.19
+ Added support for making predictions in Vercel Serverless Functions using their edge Runtime.

## 0.0.18
+ Refactored `Predictor.readme` field to `card`.

## 0.0.17
+ Added `Dtype.null` constant for working with `null` prediction values.
+ Added support for `ArrayBuffer` instances as prediction inputs.
+ Fixed `isFunctionValue` utility method throwing error on `null` input.

## 0.0.16
+ Added support for using `TypedArray` instances as prediction inputs and outputs.
+ Added `isFunctionValue` utility method for checking whether a `value` is a Function value.
+ Refactored `Feature` type to `Value` to improve clarity.
+ Refactored `FeatureValue` type to `PlainValue` to improve clarity.
+ Refactored `UploadType.Feature` enumeration member to `UploadType.Value`.
+ Refactored `featureFromValue` function to `toFunctionValue`.
+ Refactored `featureToValue` function to `toPlainValue`.

## 0.0.15
+ Fixed `fxn.environmentVariables.list` method throwing error.

## 0.0.14
+ Added UMD script for using Function without a bundler.

## 0.0.13
+ Minor stability updates.

## 0.0.12
+ Minor stability updates.

## 0.0.11
+ Added support for Vercel Edge runtime.
+ Fixed `Parameter.enumeration` field type to be `EnumerationMember[]` instead of `EnumerationMember`.

## 0.0.10
+ Added `featureFromValue` function for creating a prediction feature from a JavaScript value.
+ Added `featureToValue` function for creating a JavaScript value from a prediction feature.

## 0.0.9
+ Fixed `crypto` exception when calling `Function.predictions.create` in a web browser.

## 0.0.8
+ Removed `CreatePredictionInput.features` input field. Use `CreatePredictionInput.inputs` input field instead.
+ Removed `PREDICTION_FIELDS_RAW` constant. Use `PREDICTION_FIELDS` constant instead.
+ Removed `ParameterInput` type.

## 0.0.7
+ Added `EnumerationMember` class for working with parameters that are enumeration values.
+ Added `Parameter.enumeration` field for inspecting parameters which hold enumeration values.
+ Added `Parameter.defaultValue` field for inspecting the default value of a predictor parameter.
+ Renamed `Dtype.3d` data type to `model`.
+ Removed `Parameter.stringDefault` field. Use `Parameter.defaultValue` field instead.
+ Removed `Parameter.intDefault` field. Use `Parameter.defaultValue` field instead.
+ Removed `Parameter.floatDefault` field. Use `Parameter.defaultValue` field instead.
+ Removed `Parameter.boolDefault` field. Use `Parameter.defaultValue` field instead.

## 0.0.6
+ Added `Predictor.predictions` field for inspecting the number of predictions made with a predictor.
+ Added `Predictor.readme` field for inspecting the predictor README from the predictor notebook.
+ Fixed `Predictor.error` field not being populated for `INVALID` predictors.

## 0.0.5
+ Fixed `Function.predictors.list` function raising errors.
+ Fixed `Function.storage.createUploadUrl` function raising errors.

## 0.0.4
+ Added `EnvironmentVariable` type for managing predictor environment variables.
+ Added `Function.environmentVariables` service for managing global predictor environment variables.
+ Added `CreatePredictorInput.overwrite` input field for overwriting an existing predictor with the same tag.

## 0.0.3
+ Removed `Predictor.topics` field.

## 0.0.2
+ Populating API.

## 0.0.1
+ First pre-release.
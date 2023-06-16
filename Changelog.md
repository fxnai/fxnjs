## 0.0.11
*INCOMPLETE*

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
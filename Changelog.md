## 0.0.7
+ Renamed `Dtype.3d` data type to `model`.

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
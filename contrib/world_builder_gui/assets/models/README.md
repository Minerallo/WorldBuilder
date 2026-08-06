# Bundled hand-landmark model

`hand_landmarker.task` is the official MediaPipe Hand Landmarker model used by
the experimental Spatial Controls worker.

- Source: <https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task>
- Retrieved: 2026-08-06
- SHA-256: `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`
- Runtime: `@mediapipe/tasks-vision`, pinned by `package-lock.json`

Keeping the model local makes development and deployed builds reproducible and
ensures webcam frames do not need to leave the browser. Review the upstream
MediaPipe model terms before redistributing a packaged release.

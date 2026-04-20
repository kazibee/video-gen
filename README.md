# @kazibee/video-gen

Google Veo/Gemini video generation tool for kazibee.

## Install

```bash
kazibee install video-gen github:kazibee/video-gen
```

Install globally with `-g`:

```bash
kazibee install -g video-gen github:kazibee/video-gen
```

## Authentication

Set env vars:
- `GEMINI_API_KEY` (required)
- `GEMINI_VIDEO_MODEL` (optional)
  - default: `veo-3.1-generate-preview`

Persistent setup:

```bash
kazibee env video-gen --set GEMINI_API_KEY=your_gemini_api_key
kazibee env video-gen --set GEMINI_VIDEO_MODEL=veo-3.1-generate-preview
```

## Model Support Clarity

Use `getModelSupportGuide(model?)` to get guidance about advanced features:
- `textToVideo`
- `frameSteering` (first/last frame)
- `referenceImages`
- `videoExtension` (input-video workflows)

Important: this guidance is conservative and model-dependent.
Always verify with `listModels({ videoOnly: true })` and a small probe request.

## API

- `getModel()`
- `listModels(options?)`
- `getModelSupportGuide(model?)`
- `startGenerateVideo(prompt, options?)`
- `getOperation(operationName)`
- `cancelOperation(operationName)`
- `waitForOperation(operationName, pollIntervalMs?, timeoutMs?)`
- `generateVideo(prompt, options?)`
- `downloadVideo(uri, outputPath)`
- `downloadFirstVideoFromOperation(operationName, outputPath)`

## Advanced Generate Options

- `model?`
- `aspectRatio?` (`16:9 | 9:16 | 1:1`)
- `durationSeconds?` (`5 | 6 | 7 | 8`)
- `numberOfVideos?` (`1 | 2 | 3 | 4`)
- `personGeneration?`
- `enhancePrompt?`
- `seed?`
- `resolution?` (`720p | 1080p`)
- `negativePrompt?`
- `firstFramePath?` / `lastFramePath?`
- `referenceImages?` (recommended max 3)
- `inputVideoPath?` (for extension/variation workflows)
- `extraConfig?` (raw passthrough config overrides)

## Usage

```javascript
const model = tools["video-gen"].getModel();
const models = await tools["video-gen"].listModels({ videoOnly: true, pageSize: 100 });
const guide = await tools["video-gen"].getModelSupportGuide();

const op = await tools["video-gen"].startGenerateVideo(
  "A cinematic drone shot over snow-covered mountains at sunrise",
  {
    aspectRatio: "16:9",
    durationSeconds: 6,
    resolution: "1080p",
    negativePrompt: "logos, watermarks",
    referenceImages: [{ path: "/tmp/look-ref.png" }],
    firstFramePath: "/tmp/first-frame.png"
  }
);

const done = await tools["video-gen"].waitForOperation(op.name, 5000, 10 * 60 * 1000);

const result = await tools["video-gen"].generateVideo(
  "Slow motion close-up of ocean wave with golden-hour lighting",
  { aspectRatio: "16:9", durationSeconds: 5 }
);

const saved = await tools["video-gen"].downloadFirstVideoFromOperation(
  result.operationName,
  "/tmp/final.mp4"
);
```

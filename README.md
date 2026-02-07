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
  - default: `veo-3.0-generate-preview`

Persistent setup:

```bash
kazibee env video-gen --set GEMINI_API_KEY=your_gemini_api_key
kazibee env video-gen --set GEMINI_VIDEO_MODEL=veo-3.0-generate-preview
```

## API

- `getModel()`
- `listModels(options?)`
- `startGenerateVideo(prompt, options?)`
- `getOperation(operationName)`
- `waitForOperation(operationName, pollIntervalMs?, timeoutMs?)`
- `generateVideo(prompt, options?)`

## Usage

```javascript
const model = tools["video-gen"].getModel();
const models = await tools["video-gen"].listModels({ videoOnly: true, pageSize: 100 });

const op = await tools["video-gen"].startGenerateVideo(
  "A cinematic drone shot over snow-covered mountains at sunrise",
  { aspectRatio: "16:9", durationSeconds: 6 }
);

const done = await tools["video-gen"].waitForOperation(op.name, 5000, 10 * 60 * 1000);

const result = await tools["video-gen"].generateVideo(
  "Slow motion close-up of ocean wave with golden-hour lighting",
  { aspectRatio: "16:9", durationSeconds: 5 }
);
```

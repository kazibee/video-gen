import type { AuthConfig } from './auth';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Options for querying the Gemini models list endpoint.
 */
export interface ListModelsOptions {
  /** Maximum number of models to return. */
  pageSize?: number;
  /** If true, include only models that appear video-related. */
  videoOnly?: boolean;
}

/**
 * Basic Gemini model metadata from the models API.
 */
export interface GeminiModelInfo {
  /** Resource name, e.g. `models/veo-3.1-generate-preview`. */
  name: string;
  /** Display label for UI contexts. */
  displayName?: string;
  /** Model description text. */
  description?: string;
  /** Version field provided by API. */
  version?: string;
  /** Supported generation methods exposed by the model. */
  supportedGenerationMethods: string[];
}

/**
 * High-level capability guidance for a specific model.
 *
 * This is a guidance object for prompt/orchestration logic and is not
 * a guarantee from the API. Always verify with `listModels` + runtime calls.
 */
export interface ModelSupportGuide {
  /** Model ID (without `models/` prefix). */
  model: string;
  /** Whether base text-to-video generation is expected to work. */
  textToVideo: boolean;
  /** Whether first/last frame steering is expected to be available. */
  frameSteering: boolean;
  /** Whether multi-reference image steering is expected to be available. */
  referenceImages: boolean;
  /** Whether video extension/input-video workflows are expected to be available. */
  videoExtension: boolean;
  /** Free-form notes to help caller choose behavior. */
  notes: string[];
}

/**
 * One image input used as a generation reference.
 */
export interface ReferenceImageInput {
  /** Local filesystem path to image file. */
  path: string;
  /** Optional MIME type override (otherwise inferred). */
  mimeType?: string;
}

/**
 * Options for Veo video generation requests.
 */
export interface GenerateVideoOptions {
  /** Optional per-request model override. */
  model?: string;
  /** Output aspect ratio. */
  aspectRatio?: '16:9' | '9:16' | '1:1';
  /** Duration hint in seconds. */
  durationSeconds?: 5 | 6 | 7 | 8;
  /** Number of video variants requested. */
  numberOfVideos?: 1 | 2 | 3 | 4;
  /** Person generation policy. */
  personGeneration?: 'allow_all' | 'allow_adult' | 'dont_allow';
  /** Whether prompt enhancement should be enabled. */
  enhancePrompt?: boolean;
  /** Optional deterministic seed. */
  seed?: number;
  /** Optional resolution hint, model-dependent. */
  resolution?: '720p' | '1080p';
  /** Optional negative prompt guidance, model-dependent. */
  negativePrompt?: string;

  /**
   * Optional first-frame image for motion steering.
   * Useful for image-to-video style workflows.
   */
  firstFramePath?: string;
  /** Optional first-frame MIME type override. */
  firstFrameMimeType?: string;

  /**
   * Optional last-frame image for endpoint steering.
   * Useful when model supports frame interpolation constraints.
   */
  lastFramePath?: string;
  /** Optional last-frame MIME type override. */
  lastFrameMimeType?: string;

  /**
   * Optional reference images (recommended max: 3 for Veo guidance workflows).
   */
  referenceImages?: ReferenceImageInput[];

  /**
   * Optional input video path for extension/variation workflows.
   */
  inputVideoPath?: string;
  /** Optional input video MIME override. */
  inputVideoMimeType?: string;

  /**
   * Advanced raw config override.
   * Values here are merged last and can override all generated config fields.
   */
  extraConfig?: Record<string, unknown>;
}

/**
 * Raw operation shape returned by Gemini operations APIs.
 */
export interface OperationResult {
  name: string;
  done?: boolean;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
  response?: unknown;
  metadata?: unknown;
}

/**
 * Normalized generated video artifact from completed operations.
 */
export interface GeneratedVideoInfo {
  /** Video URI returned by API (may be signed URL or storage URI). */
  uri?: string;
  /** Preferred download URI when explicitly provided by API. */
  downloadUri?: string;
  /** MIME type of generated video artifact. */
  mimeType?: string;
}

/**
 * Final generation result returned by `generateVideo` helper.
 */
export interface GenerateVideoResult {
  operationName: string;
  model: string;
  prompt: string;
  videos: GeneratedVideoInfo[];
  rawOperation: OperationResult;
}

interface GeminiModelsResponse {
  models?: Array<{
    name?: string;
    displayName?: string;
    description?: string;
    version?: string;
    supportedGenerationMethods?: string[];
  }>;
}

/**
 * Creates the Veo/Gemini video client bound to auth config.
 */
export function createVideoGenClient(config: AuthConfig) {
  return {
    /** Returns the default model configured for this tool instance. */
    getModel: () => config.model,

    /** Lists models visible to the current API key. */
    listModels: (options: ListModelsOptions = {}) => listModels(config, options),

    /**
     * Returns model capability guidance for a specific model ID.
     *
     * Pass `model` explicitly to inspect non-default models.
     */
    getModelSupportGuide: (model?: string) => getModelSupportGuide(model ?? config.model),

    /** Starts async video generation and returns operation metadata immediately. */
    startGenerateVideo: (prompt: string, options: GenerateVideoOptions = {}) =>
      startGenerateVideo(config, prompt, options),

    /** Fetches operation status by operation name. */
    getOperation: (operationName: string) => getOperation(config, operationName),

    /** Attempts to cancel a pending operation. */
    cancelOperation: (operationName: string) => cancelOperation(config, operationName),

    /** Waits for operation completion with polling and timeout controls. */
    waitForOperation: (
      operationName: string,
      pollIntervalMs = 5000,
      timeoutMs = 10 * 60 * 1000,
    ) => waitForOperation(config, operationName, pollIntervalMs, timeoutMs),

    /**
     * Convenience wrapper: starts generation, waits for completion,
     * and returns extracted video outputs.
     */
    generateVideo: async (prompt: string, options: GenerateVideoOptions = {}) => {
      const effectiveModel = options.model?.trim() || config.model;
      const op = await startGenerateVideo(config, prompt, options);
      const done = await waitForOperation(config, op.name, 5000, 10 * 60 * 1000);

      if (done.error) {
        throw new Error(
          `Video generation failed: ${done.error.message ?? JSON.stringify(done.error)}`,
        );
      }

      return {
        operationName: done.name,
        model: effectiveModel,
        prompt,
        videos: extractGeneratedVideos(done.response),
        rawOperation: done,
      } satisfies GenerateVideoResult;
    },

    /**
     * Downloads a generated video URI to local disk.
     *
     * Notes:
     * - Supports direct HTTP(S) URIs.
     * - If URI is non-HTTP (e.g. provider-specific storage URI), caller
     *   should convert/resolve to signed HTTP URL first.
     */
    downloadVideo: (uri: string, outputPath: string) => downloadVideo(uri, outputPath),

    /**
     * Finds the first generated video URI in an operation payload and downloads it.
     */
    downloadFirstVideoFromOperation: async (operationName: string, outputPath: string) => {
      const op = await getOperation(config, operationName);
      const videos = extractGeneratedVideos(op.response);
      const uri = videos[0]?.downloadUri || videos[0]?.uri;
      if (!uri) {
        throw new Error(`No downloadable video URI found in operation: ${operationName}`);
      }
      return downloadVideo(uri, outputPath);
    },
  };
}

/**
 * Queries Gemini models endpoint.
 */
async function listModels(
  config: AuthConfig,
  options: ListModelsOptions,
): Promise<GeminiModelInfo[]> {
  const params = new URLSearchParams();
  if (options.pageSize) params.set('pageSize', String(options.pageSize));

  const url = `${API_BASE}/models?${params.toString()}&key=${encodeURIComponent(config.apiKey)}`;
  const res = await fetch(url);
  const json = (await res.json()) as GeminiModelsResponse;

  if (!res.ok) {
    throw new Error(`Gemini models API error ${res.status}: ${JSON.stringify(json)}`);
  }

  const mapped: GeminiModelInfo[] = (json.models ?? []).map((model) => ({
    name: model.name ?? '',
    displayName: model.displayName,
    description: model.description,
    version: model.version,
    supportedGenerationMethods: model.supportedGenerationMethods ?? [],
  }));

  if (!options.videoOnly) return mapped;

  return mapped.filter((model) => {
    const hay = `${model.name} ${model.displayName ?? ''} ${model.description ?? ''}`.toLowerCase();
    return hay.includes('video') || hay.includes('veo');
  });
}

/**
 * Starts a `generateVideos` operation.
 */
async function startGenerateVideo(
  config: AuthConfig,
  prompt: string,
  options: GenerateVideoOptions,
): Promise<OperationResult> {
  const model = options.model?.trim() || config.model;
  const url = `${API_BASE}/models/${encodeURIComponent(model)}:generateVideos?key=${encodeURIComponent(config.apiKey)}`;

  const referenceImages = options.referenceImages ?? [];
  if (referenceImages.length > 3) {
    throw new Error('referenceImages supports up to 3 images for Veo-oriented workflows.');
  }

  const body = {
    prompt,
    ...(await buildMediaInputs({
      firstFramePath: options.firstFramePath,
      firstFrameMimeType: options.firstFrameMimeType,
      lastFramePath: options.lastFramePath,
      lastFrameMimeType: options.lastFrameMimeType,
      inputVideoPath: options.inputVideoPath,
      inputVideoMimeType: options.inputVideoMimeType,
      referenceImages,
    })),
    config: {
      ...(options.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
      ...(options.durationSeconds ? { durationSeconds: options.durationSeconds } : {}),
      ...(options.numberOfVideos ? { numberOfVideos: options.numberOfVideos } : {}),
      ...(options.personGeneration ? { personGeneration: options.personGeneration } : {}),
      ...(options.enhancePrompt !== undefined ? { enhancePrompt: options.enhancePrompt } : {}),
      ...(options.seed !== undefined ? { seed: options.seed } : {}),
      ...(options.resolution ? { resolution: options.resolution } : {}),
      ...(options.negativePrompt ? { negativePrompt: options.negativePrompt } : {}),
      ...(options.extraConfig ?? {}),
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.apiKey,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as OperationResult;
  if (!res.ok) {
    throw new Error(`generateVideos error ${res.status}: ${JSON.stringify(json)}`);
  }

  if (!json.name) {
    throw new Error(`generateVideos did not return operation name: ${JSON.stringify(json)}`);
  }

  return json;
}

/**
 * Retrieves an operation payload by operation name.
 */
async function getOperation(config: AuthConfig, operationName: string): Promise<OperationResult> {
  const normalized = operationName.startsWith('operations/') ? operationName : `operations/${operationName}`;
  const url = `${API_BASE}/${normalized}?key=${encodeURIComponent(config.apiKey)}`;

  const res = await fetch(url, {
    headers: {
      'x-goog-api-key': config.apiKey,
    },
  });

  const json = (await res.json()) as OperationResult;
  if (!res.ok) {
    throw new Error(`getOperation error ${res.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

/**
 * Attempts to cancel an operation.
 */
async function cancelOperation(config: AuthConfig, operationName: string): Promise<void> {
  const normalized = operationName.startsWith('operations/') ? operationName : `operations/${operationName}`;
  const url = `${API_BASE}/${normalized}:cancel?key=${encodeURIComponent(config.apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.apiKey,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const json = await safeJson(res);
    throw new Error(`cancelOperation error ${res.status}: ${JSON.stringify(json)}`);
  }
}

/**
 * Polls operation status until completion or timeout.
 */
async function waitForOperation(
  config: AuthConfig,
  operationName: string,
  pollIntervalMs: number,
  timeoutMs: number,
): Promise<OperationResult> {
  const start = Date.now();

  while (true) {
    const op = await getOperation(config, operationName);
    if (op.done) return op;

    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for operation ${operationName}`);
    }

    await sleep(pollIntervalMs);
  }
}

/**
 * Extracts generated video artifacts from known response shapes.
 */
function extractGeneratedVideos(response: unknown): GeneratedVideoInfo[] {
  if (!response || typeof response !== 'object') return [];

  const obj = response as Record<string, unknown>;
  const samples = [
    ((obj.generateVideosResponse as any)?.generatedSamples ?? []) as any[],
    ((obj.generateVideoResponse as any)?.generatedSamples ?? []) as any[],
    (obj.generatedSamples ?? []) as any[],
  ].find((arr) => Array.isArray(arr)) ?? [];

  return samples
    .map((sample) => sample?.video)
    .filter(Boolean)
    .map((video) => ({
      uri: video.uri,
      downloadUri: video.downloadUri ?? video.uri,
      mimeType: video.mimeType,
    }));
}

/**
 * Model capability guidance map.
 *
 * Keep this conservative: when uncertain, mark optional and instruct callers
 * to validate with runtime calls.
 */
function getModelSupportGuide(model: string): ModelSupportGuide {
  const normalized = model.replace(/^models\//, '').toLowerCase();

  if (normalized.includes('veo-3.1')) {
    return {
      model,
      textToVideo: true,
      frameSteering: true,
      referenceImages: true,
      videoExtension: true,
      notes: [
        'Best default for advanced Veo workflows in this plugin.',
        'Supports richer steering options in docs examples.',
      ],
    };
  }

  if (normalized.includes('veo-3')) {
    return {
      model,
      textToVideo: true,
      frameSteering: true,
      referenceImages: true,
      videoExtension: true,
      notes: [
        'Likely supports most advanced controls, but behavior may vary by release.',
        'Verify with a quick low-cost test request.',
      ],
    };
  }

  if (normalized.includes('veo-2')) {
    return {
      model,
      textToVideo: true,
      frameSteering: false,
      referenceImages: false,
      videoExtension: false,
      notes: [
        'Treat as baseline text-to-video unless docs specify otherwise for your endpoint.',
      ],
    };
  }

  return {
    model,
    textToVideo: true,
    frameSteering: false,
    referenceImages: false,
    videoExtension: false,
    notes: [
      'Unknown model family. Run `listModels` and verify by small probe request.',
    ],
  };
}

/**
 * Downloads an HTTP(S) video URI to disk.
 */
async function downloadVideo(uri: string, outputPath: string): Promise<{ outputPath: string; sizeBytes: number }> {
  if (!/^https?:\/\//i.test(uri)) {
    throw new Error(`Only HTTP(S) URIs are supported for direct download. Got: ${uri}`);
  }

  const res = await fetch(uri);
  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(`downloadVideo error ${res.status}: ${JSON.stringify(body)}`);
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  await Bun.write(outputPath, bytes);
  return { outputPath, sizeBytes: bytes.length };
}

/**
 * Builds optional media input blocks for generateVideos requests.
 */
async function buildMediaInputs(inputs: {
  firstFramePath?: string;
  firstFrameMimeType?: string;
  lastFramePath?: string;
  lastFrameMimeType?: string;
  inputVideoPath?: string;
  inputVideoMimeType?: string;
  referenceImages: ReferenceImageInput[];
}): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};

  if (inputs.firstFramePath) {
    result.firstFrame = await fileToInlineData(inputs.firstFramePath, inputs.firstFrameMimeType);
  }

  if (inputs.lastFramePath) {
    result.lastFrame = await fileToInlineData(inputs.lastFramePath, inputs.lastFrameMimeType);
  }

  if (inputs.inputVideoPath) {
    result.video = await fileToInlineData(inputs.inputVideoPath, inputs.inputVideoMimeType);
  }

  if (inputs.referenceImages.length) {
    result.referenceImages = await Promise.all(
      inputs.referenceImages.map((item) => fileToInlineData(item.path, item.mimeType)),
    );
  }

  return result;
}

/**
 * Converts local file into inline data object for API payloads.
 */
async function fileToInlineData(path: string, overrideMimeType?: string): Promise<{ mimeType: string; data: string }> {
  const file = Bun.file(path);
  const exists = await file.exists();
  if (!exists) {
    throw new Error(`File not found: ${path}`);
  }

  const mimeType = overrideMimeType || file.type || inferMimeFromPath(path) || 'application/octet-stream';
  const data = Buffer.from(await file.arrayBuffer()).toString('base64');
  return { mimeType, data };
}

/**
 * Best-effort MIME inference based on extension when runtime type is unavailable.
 */
function inferMimeFromPath(path: string): string | undefined {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  return undefined;
}

/**
 * Sleep helper for polling.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempts JSON parse for failed HTTP responses.
 */
async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return await res.text();
  }
}

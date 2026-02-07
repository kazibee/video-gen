import type { AuthConfig } from './auth';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Options for model discovery. */
export interface ListModelsOptions {
  pageSize?: number;
  videoOnly?: boolean;
}

/** Basic Gemini model metadata. */
export interface GeminiModelInfo {
  name: string;
  displayName?: string;
  description?: string;
  version?: string;
  supportedGenerationMethods: string[];
}

/** Video generation request options. */
export interface GenerateVideoOptions {
  aspectRatio?: '16:9' | '9:16' | '1:1';
  durationSeconds?: 5 | 6 | 7 | 8;
  numberOfVideos?: 1 | 2 | 3 | 4;
  personGeneration?: 'allow_all' | 'allow_adult' | 'dont_allow';
  enhancePrompt?: boolean;
  seed?: number;
}

/** Raw operation shape returned by Gemini operations endpoints. */
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

/** Extracted generated video artifact info from completed operations. */
export interface GeneratedVideoInfo {
  uri?: string;
  downloadUri?: string;
  mimeType?: string;
}

/** Final result for completed video generation. */
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

/** Creates the video generation client bound to auth config. */
export function createVideoGenClient(config: AuthConfig) {
  return {
    /** Returns the active model ID. */
    getModel: () => config.model,

    /** Lists models visible to this API key. */
    listModels: (options: ListModelsOptions = {}) => listModels(config, options),

    /** Starts an async video generation operation and returns operation metadata. */
    startGenerateVideo: (prompt: string, options: GenerateVideoOptions = {}) =>
      startGenerateVideo(config, prompt, options),

    /** Fetches operation status by operation name. */
    getOperation: (operationName: string) => getOperation(config, operationName),

    /** Waits for operation completion and returns operation payload. */
    waitForOperation: (
      operationName: string,
      pollIntervalMs = 5000,
      timeoutMs = 10 * 60 * 1000,
    ) => waitForOperation(config, operationName, pollIntervalMs, timeoutMs),

    /** Convenience wrapper: start + wait + extracted video outputs. */
    generateVideo: async (prompt: string, options: GenerateVideoOptions = {}) => {
      const op = await startGenerateVideo(config, prompt, options);
      const done = await waitForOperation(config, op.name, 5000, 10 * 60 * 1000);
      if (done.error) {
        throw new Error(
          `Video generation failed: ${done.error.message ?? JSON.stringify(done.error)}`,
        );
      }

      return {
        operationName: done.name,
        model: config.model,
        prompt,
        videos: extractGeneratedVideos(done.response),
        rawOperation: done,
      } satisfies GenerateVideoResult;
    },
  };
}

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

async function startGenerateVideo(
  config: AuthConfig,
  prompt: string,
  options: GenerateVideoOptions,
): Promise<OperationResult> {
  const url = `${API_BASE}/models/${encodeURIComponent(config.model)}:generateVideos?key=${encodeURIComponent(config.apiKey)}`;

  const body = {
    prompt,
    config: {
      ...(options.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
      ...(options.durationSeconds ? { durationSeconds: options.durationSeconds } : {}),
      ...(options.numberOfVideos ? { numberOfVideos: options.numberOfVideos } : {}),
      ...(options.personGeneration ? { personGeneration: options.personGeneration } : {}),
      ...(options.enhancePrompt !== undefined ? { enhancePrompt: options.enhancePrompt } : {}),
      ...(options.seed !== undefined ? { seed: options.seed } : {}),
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

function extractGeneratedVideos(response: unknown): GeneratedVideoInfo[] {
  if (!response || typeof response !== 'object') return [];

  const obj = response as any;
  const samples: any[] = obj.generateVideosResponse?.generatedSamples ?? obj.generatedSamples ?? [];

  return samples
    .map((sample) => sample?.video)
    .filter(Boolean)
    .map((video) => ({
      uri: video.uri,
      downloadUri: video.downloadUri ?? video.uri,
      mimeType: video.mimeType,
    }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

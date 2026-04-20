export interface Env {
	GEMINI_API_KEY: string;
	GEMINI_VIDEO_MODEL?: string;
}
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
	aspectRatio?: "16:9" | "9:16" | "1:1";
	/** Duration hint in seconds. */
	durationSeconds?: 5 | 6 | 7 | 8;
	/** Number of video variants requested. */
	numberOfVideos?: 1 | 2 | 3 | 4;
	/** Person generation policy. */
	personGeneration?: "allow_all" | "allow_adult" | "dont_allow";
	/** Whether prompt enhancement should be enabled. */
	enhancePrompt?: boolean;
	/** Optional deterministic seed. */
	seed?: number;
	/** Optional resolution hint, model-dependent. */
	resolution?: "720p" | "1080p";
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
declare function main(env: Env): {
	getModel: () => Promise<string>;
	listModels: (options?: ListModelsOptions) => Promise<GeminiModelInfo[]>;
	getModelSupportGuide: (model?: string) => Promise<ModelSupportGuide>;
	startGenerateVideo: (prompt: string, options?: GenerateVideoOptions) => Promise<OperationResult>;
	getOperation: (operationName: string) => Promise<OperationResult>;
	cancelOperation: (operationName: string) => Promise<void>;
	waitForOperation: (operationName: string, pollIntervalMs?: number, timeoutMs?: number) => Promise<OperationResult>;
	generateVideo: (prompt: string, options?: GenerateVideoOptions) => Promise<{
		operationName: string;
		model: string;
		prompt: string;
		videos: GeneratedVideoInfo[];
		rawOperation: OperationResult;
	}>;
	downloadVideo: (uri: string, outputPath: string) => Promise<{
		outputPath: string;
		sizeBytes: number;
	}>;
	downloadFirstVideoFromOperation: (operationName: string, outputPath: string) => Promise<{
		outputPath: string;
		sizeBytes: number;
	}>;
};

export {
	main as default,
};

export {};

export interface Env {
  GEMINI_API_KEY: string;
  GEMINI_VIDEO_MODEL?: string;
}

export interface AuthConfig {
  apiKey: string;
  model: string;
}

const DEFAULT_VIDEO_MODEL = 'veo-3.0-generate-preview';

/** Reads env config for Google Veo/Gemini video generation. */
export function getAuthConfig(env: Env): AuthConfig {
  if (!env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY in environment.');
  }

  return {
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_VIDEO_MODEL?.trim() || DEFAULT_VIDEO_MODEL,
  };
}

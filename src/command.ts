export interface LoginResult {
  GEMINI_API_KEY: string;
  GEMINI_VIDEO_MODEL?: string;
}

/**
 * Google Veo/Gemini uses API-key auth; configure via environment.
 */
export async function login(): Promise<LoginResult> {
  throw new Error(
    'Set GEMINI_API_KEY via environment. Optional: GEMINI_VIDEO_MODEL (default veo-3.1-generate-preview).',
  );
}

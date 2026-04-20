import { getAuthConfig, type Env } from './auth';
import { createVideoGenClient } from './video-gen-client';

export type { Env } from './auth';
export type {
  ListModelsOptions,
  GeminiModelInfo,
  ModelSupportGuide,
  ReferenceImageInput,
  GenerateVideoOptions,
  OperationResult,
  GeneratedVideoInfo,
  GenerateVideoResult,
} from './video-gen-client';

export default function main(env: Env) {
  const config = getAuthConfig(env);
  return createVideoGenClient(config);
}

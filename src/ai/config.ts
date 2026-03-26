export const DEFAULT_GOOGLE_GENAI_MODEL = 'gemini-3.1-flash-lite-preview';
export const DEFAULT_GOOGLE_GENAI_MODEL_LABEL = DEFAULT_GOOGLE_GENAI_MODEL;

type AiEnv = Record<string, string | undefined>;

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return undefined;
}

export function resolveGoogleGenAiApiKey(env: AiEnv = process.env): string | undefined {
  return firstNonEmpty(
    env.GOOGLE_API_KEY,
    env.GOOGLE_GENAI_API_KEY,
    env.GEMINI_API_KEY
  );
}

export function hasGoogleGenAiApiKey(env: AiEnv = process.env): boolean {
  return Boolean(resolveGoogleGenAiApiKey(env));
}

export function resolveGoogleGenAiModelCode(env: AiEnv = process.env): string {
  return firstNonEmpty(
    env.GOOGLE_GENAI_MODEL,
    env.GEMINI_MODEL
  ) ?? DEFAULT_GOOGLE_GENAI_MODEL;
}

export function resolveGoogleGenAiModelLabel(env: AiEnv = process.env): string {
  return resolveGoogleGenAiModelCode(env);
}

export function resolveGenkitModelRef(env: AiEnv = process.env): string {
  return `googleai/${resolveGoogleGenAiModelCode(env)}`;
}

export function buildSharedAiRuntimeConfig(env: AiEnv = process.env): {
  apiKey: string | undefined;
  model: string;
  modelLabel: string;
} {
  return {
    apiKey: resolveGoogleGenAiApiKey(env),
    model: resolveGenkitModelRef(env),
    modelLabel: resolveGoogleGenAiModelLabel(env),
  };
}

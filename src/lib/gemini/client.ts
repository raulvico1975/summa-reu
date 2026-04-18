import { serverEnv } from "@/src/lib/firebase/env";

type GeminiPart =
  | { text: string }
  | {
      inline_data: {
        mime_type: string;
        data: string;
      };
    }
  | {
      file_data: {
        mime_type: string;
        file_uri: string;
      };
    };

type GenerateContentPayload = {
  model: string;
  contents: Array<{
    role: "user" | "model";
    parts: GeminiPart[];
  }>;
  generationConfig?: {
    temperature?: number;
    responseMimeType?: string;
    maxOutputTokens?: number;
  };
};

export function hasGeminiApiKey(): boolean {
  return Boolean(serverEnv.geminiApiKey);
}

async function geminiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!serverEnv.geminiApiKey) {
    throw new Error("GEMINI_API_KEY_MISSING");
  }

  const separator = path.includes("?") ? "&" : "?";
  const url = `${serverEnv.geminiBaseUrl}${path}${separator}key=${encodeURIComponent(serverEnv.geminiApiKey)}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GEMINI_HTTP_${res.status}:${body}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {} as T;
  }

  return (await res.json()) as T;
}

type GeminiFileMetadata = {
  name?: string;
  uri?: string;
  mimeType?: string;
  mime_type?: string;
  state?: string;
};

async function geminiUploadFetch<T>(url: string, init?: RequestInit): Promise<{
  headers: Headers;
  body: T;
}> {
  if (!serverEnv.geminiApiKey) {
    throw new Error("GEMINI_API_KEY_MISSING");
  }

  const res = await fetch(url, {
    ...init,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GEMINI_HTTP_${res.status}:${body}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? ((await res.json()) as T) : ({} as T);

  return {
    headers: res.headers,
    body,
  };
}

export async function listGeminiModels(): Promise<
  Array<{ name: string; supportedGenerationMethods?: string[] }>
> {
  const response = await geminiFetch<{ models?: Array<{ name: string; supportedGenerationMethods?: string[] }> }>(
    "/v1beta/models"
  );
  return response.models ?? [];
}

export async function uploadGeminiFile(input: {
  bytes: Buffer;
  mimeType: string;
  displayName: string;
}): Promise<{ name: string; uri: string; mimeType: string }> {
  const start = await geminiUploadFetch<{ file?: GeminiFileMetadata }>(
    `${serverEnv.geminiBaseUrl}/upload/v1beta/files`,
    {
    method: "POST",
    headers: {
      "x-goog-api-key": serverEnv.geminiApiKey ?? "",
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(input.bytes.length),
      "X-Goog-Upload-Header-Content-Type": input.mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file: {
        display_name: input.displayName,
      },
    }),
    }
  );

  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new Error("GEMINI_UPLOAD_URL_MISSING");
  }

  const uploaded = await geminiUploadFetch<{ file?: GeminiFileMetadata }>(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(input.bytes.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: new Uint8Array(input.bytes),
  });

  const response = uploaded.body.file;
  const name = response?.name ?? start.body.file?.name ?? null;
  const uri = response?.uri ?? start.body.file?.uri ?? null;
  const mimeType = response?.mimeType ?? response?.mime_type ?? input.mimeType;

  if (!name || !uri) {
    throw new Error("GEMINI_FILE_UPLOAD_INCOMPLETE");
  }

  return {
    name,
    uri,
    mimeType,
  };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForGeminiFileActive(
  name: string,
  options?: { attempts?: number; delayMs?: number }
): Promise<{ name: string; uri: string; mimeType: string }> {
  const attempts = options?.attempts ?? 12;
  const delayMs = options?.delayMs ?? 1000;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await geminiFetch<{ file?: GeminiFileMetadata }>(`/v1beta/${name}`);
    const file = response.file;
    const state = file?.state?.toUpperCase() ?? "ACTIVE";

    if (state === "ACTIVE") {
      if (!file?.name || !file?.uri) {
        throw new Error("GEMINI_FILE_METADATA_MISSING");
      }

      return {
        name: file.name,
        uri: file.uri,
        mimeType: file.mimeType ?? file.mime_type ?? "application/octet-stream",
      };
    }

    if (state === "FAILED") {
      throw new Error("GEMINI_FILE_PROCESSING_FAILED");
    }

    await sleep(delayMs);
  }

  throw new Error("GEMINI_FILE_PROCESSING_TIMEOUT");
}

export async function deleteGeminiFile(name: string): Promise<void> {
  await geminiFetch<unknown>(`/v1beta/${name}`, {
    method: "DELETE",
  });
}

function extractTextFromCandidate(raw: unknown): string {
  const data = raw as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

export async function generateGeminiText(payload: GenerateContentPayload): Promise<string> {
  const body = {
    contents: payload.contents,
    generationConfig: payload.generationConfig,
  };

  const path = `/v1beta/models/${payload.model}:generateContent`;
  const response = await geminiFetch<unknown>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const text = extractTextFromCandidate(response);
  if (!text) {
    throw new Error("GEMINI_EMPTY_RESPONSE");
  }

  return text;
}

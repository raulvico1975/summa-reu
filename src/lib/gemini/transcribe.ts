import {
  deleteGeminiFile,
  generateGeminiText,
  uploadGeminiFile,
  waitForGeminiFileActive,
} from "@/src/lib/gemini/client";

const MAX_INLINE_BYTES = 20 * 1024 * 1024;

export async function transcribeWithGemini(input: {
  model: string;
  audioBytes: Buffer;
  mimeType: string;
  displayName?: string;
}): Promise<string> {
  const prompt =
    "Transcriu aquest àudio de reunió. Retorna només text pla, amb salts de línia entre intervencions.";
  let uploadedFileName: string | null = null;
  try {
    const parts =
      input.audioBytes.length > MAX_INLINE_BYTES
        ? await (async () => {
            const uploaded = await uploadGeminiFile({
              bytes: input.audioBytes,
              mimeType: input.mimeType,
              displayName: input.displayName ?? "meeting-audio",
            });
            uploadedFileName = uploaded.name;
            const active = await waitForGeminiFileActive(uploaded.name);

            return [
              { text: prompt },
              {
                file_data: {
                  mime_type: active.mimeType,
                  file_uri: active.uri,
                },
              },
            ];
          })()
        : [
            { text: prompt },
            {
              inline_data: {
                mime_type: input.mimeType,
                data: input.audioBytes.toString("base64"),
              },
            },
          ];

    const text = await generateGeminiText({
      model: input.model,
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
    });

    return text.trim();
  } finally {
    if (uploadedFileName) {
      try {
        await deleteGeminiFile(uploadedFileName);
      } catch {
        // Uploaded files expire automatically; cleanup is best-effort.
      }
    }
  }
}

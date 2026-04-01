import { generateGeminiText } from "@/src/lib/gemini/client";
import { minutesJsonSchema, type MinutesJsonStrict } from "@/src/lib/minutes/schema";
import { renderMinutesMarkdown } from "@/src/lib/minutes/markdown";

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseMinutesJson(raw: string): MinutesJsonStrict {
  const candidate = stripCodeFences(raw);
  const parsed = JSON.parse(candidate) as unknown;
  return minutesJsonSchema.parse(parsed);
}

const languageConfig = {
  ca: {
    role: "Ets assistent de secretaria d'una entitat social.",
    instruction: "Genera una acta en català a partir de la transcripció.",
    format: "Retorna NOMÉS JSON vàlid, sense text extra.",
    fallback: "Si falten dades, usa null o arrays buids.",
    transcriptLabel: "Transcripció:",
  },
  es: {
    role: "Eres asistente de secretaría de una entidad social.",
    instruction: "Genera un acta en español a partir de la transcripción.",
    format: "Devuelve SOLO JSON válido, sin texto extra.",
    fallback: "Si faltan datos, usa null o arrays vacíos.",
    transcriptLabel: "Transcripción:",
  },
} as const;

function buildPrompt(transcript: string, language: "ca" | "es"): string {
  const lang = languageConfig[language];
  return [
    lang.role,
    lang.instruction,
    lang.format,
    "Esquema obligatori:",
    "{",
    `  "language": "${language}",`,
    '  "summary": string,',
    '  "attendees": string[],',
    '  "agenda": string[],',
    '  "decisions": [{"id": string, "text": string, "owner": string|null, "dueDate": string|null, "tags": string[]}],',
    '  "tasks": [{"id": string, "text": string, "owner": string|null, "dueDate": string|null, "status": "todo"|"doing"|"done"}]',
    "}",
    lang.fallback,
    lang.transcriptLabel,
    transcript,
  ].join("\n");
}

export async function generateMinutesWithGemini(input: {
  model: string;
  transcript: string;
  language?: "ca" | "es";
}): Promise<{ minutesJson: MinutesJsonStrict; minutesMarkdown: string }> {
  const language = input.language ?? "ca";
  const prompt = buildPrompt(input.transcript, language);

  const raw = await generateGeminiText({
    model: input.model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
    },
  });

  try {
    const minutesJson = parseMinutesJson(raw);
    return {
      minutesJson,
      minutesMarkdown: renderMinutesMarkdown(minutesJson),
    };
  } catch {
    const fixRaw = await generateGeminiText({
      model: input.model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                language === "es"
                  ? "Convierte este contenido en JSON válido que cumpla exactamente el esquema pedido."
                  : "Converteix aquest contingut en JSON vàlid que compleixi exactament l'esquema demanat.",
                language === "es"
                  ? "No añadas texto fuera del JSON."
                  : "No afegeixis text fora del JSON.",
                raw,
              ].join("\n\n"),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

    const minutesJson = parseMinutesJson(fixRaw);
    return {
      minutesJson,
      minutesMarkdown: renderMinutesMarkdown(minutesJson),
    };
  }
}

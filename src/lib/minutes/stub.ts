import crypto from "node:crypto";
import type { MinutesJsonStrict } from "@/src/lib/minutes/schema";

function pick<T>(seed: number, values: T[]): T {
  return values[seed % values.length]!;
}

export function buildStubTranscript(input: {
  meetingId: string;
  recordingId: string;
  rawText?: string | null;
}): string {
  if (input.rawText && input.rawText.trim().length > 0) {
    return input.rawText.trim();
  }

  const seedHex = crypto
    .createHash("sha1")
    .update(`${input.meetingId}:${input.recordingId}`)
    .digest("hex")
    .slice(0, 8);

  const seed = Number.parseInt(seedHex, 16);

  const topics = [
    "pressupost trimestral",
    "captació de voluntariat",
    "calendari d'activitats",
    "seguiment de subvencions",
  ];

  return [
    `Anna: Obrim la reunió sobre ${pick(seed, topics)}.`,
    "Pere: Revisem els punts prioritaris i validem responsabilitats.",
    "Laia: Confirmem terminis abans de la propera junta.",
    "Marc: Queden tasques pendents de coordinació amb comunicació.",
    "Anna: Tanquem amb acord i seguiment en set dies.",
  ].join("\n");
}

export function buildStubMinutes(transcript: string, language?: "ca" | "es"): MinutesJsonStrict {
  const lines = transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const attendees = Array.from(
    new Set(
      lines
        .map((line) => line.split(":")[0]?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );

  return {
    language: language ?? "ca",
    summary: "Revisió de punts operatius, acord de prioritats i assignació de seguiment.",
    attendees,
    agenda: [
      "Revisió de l'estat actual",
      "Acords de coordinació",
      "Tasques i terminis",
    ],
    decisions: [
      {
        id: "d1",
        text: "Validar pressupost actualitzat abans de la propera reunió.",
        owner: "Tresoreria",
        dueDate: null,
        tags: ["pressupost"],
      },
      {
        id: "d2",
        text: "Coordinar captació de voluntariat amb equip de comunicació.",
        owner: "Comunicació",
        dueDate: null,
        tags: ["voluntariat"],
      },
    ],
    tasks: [
      {
        id: "t1",
        text: "Compartir resum d'accions amb l'equip.",
        owner: "Secretaria",
        dueDate: null,
        status: "todo",
      },
      {
        id: "t2",
        text: "Fer seguiment de tasques en 7 dies.",
        owner: "Coordinació",
        dueDate: null,
        status: "doing",
      },
    ],
  };
}

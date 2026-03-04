import { serverEnv } from "@/src/lib/firebase/env";

type IncidentSource = "api" | "server" | "client";

type TelegramIncidentInput = {
  source: IncidentSource;
  summary: string;
  where: string;
  impact: string;
  dedupeKey: string;
  userAction?: string;
};

const dedupeMemory = new Map<string, number>();
const DEDUPE_WINDOW_MS = 10 * 60_000;

function shouldNotify(dedupeKey: string): boolean {
  const now = Date.now();
  const previous = dedupeMemory.get(dedupeKey);
  if (previous && now - previous < DEDUPE_WINDOW_MS) {
    return false;
  }

  dedupeMemory.set(dedupeKey, now);
  return true;
}

function isEnabled(): boolean {
  return serverEnv.telegramAlertsEnabled === "true";
}

function formatNowHuman(): string {
  return new Intl.DateTimeFormat("ca-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date());
}

function buildHumanMessage(input: TelegramIncidentInput): string {
  const lines = [
    `Summa-Board: ${input.summary}`,
    `On ha passat: ${input.where}`,
    `Impacte probable: ${input.impact}`,
    `Moment: ${formatNowHuman()} (Europe/Madrid)`,
    `Origen: ${input.source.toUpperCase()}`,
  ];

  if (input.userAction) {
    lines.push(`Què recomanem ara: ${input.userAction}`);
  }

  return lines.join("\n");
}

async function sendTelegramMessage(text: string): Promise<void> {
  const token = serverEnv.telegramBotToken;
  const chatId = serverEnv.telegramChatId;

  if (!token || !chatId) {
    return;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram sendMessage failed (${response.status}): ${body}`);
  }
}

export async function notifyTelegramIncident(input: TelegramIncidentInput): Promise<void> {
  if (!isEnabled()) {
    return;
  }

  if (!shouldNotify(input.dedupeKey)) {
    return;
  }

  const message = buildHumanMessage(input);

  try {
    await sendTelegramMessage(message);
  } catch (error) {
    console.error("monitoring.telegram.send_failed", {
      error: error instanceof Error ? error.message : String(error),
      dedupeKey: input.dedupeKey,
    });
  }
}

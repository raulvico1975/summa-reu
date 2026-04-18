import crypto from "node:crypto";
import { serverEnv } from "@/src/lib/firebase/env";

const DAILY_AUDIO_RECORDING_TYPE = "cloud-audio-only";
const DAILY_WEBHOOK_EVENT_TYPES = ["recording.ready-to-download"];

type DailyRoomResponse = {
  name?: string;
  url?: string;
};

type DailyStartRecordingResponse = {
  recording_id?: string;
  status?: string;
};

type DailyWebhookDoc = {
  uuid?: string;
  url?: string;
  hmac?: string | null;
  state?: "ACTIVE" | "FAILED" | string;
  retryType?: "circuit-breaker" | "exponential" | string;
  eventTypes?: string[];
};

type DailyRecordingDoc = {
  id?: string;
  room_name?: string;
  status?: string;
  start_ts?: number;
};

type DailyRecordingListResponse = {
  data?: DailyRecordingDoc[];
};

function requireDailyConfig(): { apiKey: string; apiBaseUrl: string; domain: string } {
  if (serverEnv.dailyMockMode) {
    return {
      apiKey: "mock",
      apiBaseUrl: "https://daily.mock/v1",
      domain: serverEnv.dailyDomain ?? "mock.daily.local",
    };
  }

  if (!serverEnv.dailyApiKey || !serverEnv.dailyDomain) {
    throw new Error("DAILY_NOT_CONFIGURED");
  }

  return {
    apiKey: serverEnv.dailyApiKey,
    apiBaseUrl: serverEnv.dailyApiBaseUrl,
    domain: serverEnv.dailyDomain,
  };
}

function normalizeDailyDomain(domain: string): string {
  const trimmedDomain = domain.replace(/\/+$/, "");

  if (trimmedDomain.startsWith("http://") || trimmedDomain.startsWith("https://")) {
    return trimmedDomain;
  }

  if (trimmedDomain.includes(".")) {
    return `https://${trimmedDomain}`;
  }

  return `https://${trimmedDomain}.daily.co`;
}

async function dailyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const config = requireDailyConfig();
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DAILY_HTTP_${res.status}:${body}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 48);
}

export function buildDailyRoomName(title: string): string {
  const base = slugify(title) || "meeting";
  return `${base}-${crypto.randomBytes(3).toString("hex")}`;
}

export function buildDailyRoomUrl(roomName: string): string {
  const config = requireDailyConfig();
  return `${normalizeDailyDomain(config.domain)}/${roomName}`;
}

export function getDailyRoomNameFromUrl(meetingUrl: string): string {
  try {
    const url = new URL(meetingUrl);
    const roomName = url.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    if (!roomName) {
      throw new Error("DAILY_ROOM_NAME_MISSING");
    }

    return roomName;
  } catch {
    throw new Error("DAILY_ROOM_URL_INVALID");
  }
}

export function getDailyWebhookTargetUrl(): string {
  return `https://${serverEnv.canonicalHost}/api/webhooks/daily/recording-complete`;
}

function isBase64(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  try {
    return Buffer.from(normalized, "base64").toString("base64").replace(/=+$/g, "") === normalized.replace(/=+$/g, "");
  } catch {
    return false;
  }
}

export function buildDailyWebhookSignature(rawBody: string, sharedSecretBase64: string): string {
  return crypto
    .createHmac("sha256", Buffer.from(sharedSecretBase64, "base64"))
    .update(rawBody)
    .digest("base64");
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAuthorizedDailyWebhook(input: {
  authHeader: string | null;
  signatureHeader: string | null;
  rawBody: string;
  sharedSecret: string | null;
}): boolean {
  const expected = input.sharedSecret?.trim() ?? null;
  if (!expected) {
    return true;
  }

  if (input.authHeader === `Bearer ${expected}`) {
    return true;
  }

  if (!isBase64(expected) || !input.signatureHeader) {
    return false;
  }

  return timingSafeEqual(
    input.signatureHeader.trim(),
    buildDailyWebhookSignature(input.rawBody, expected)
  );
}

export async function createDailyRoom(input: { title: string }): Promise<{ roomName: string; meetingUrl: string }> {
  const roomName = buildDailyRoomName(input.title);
  if (serverEnv.dailyMockMode) {
    return {
      roomName,
      meetingUrl: buildDailyRoomUrl(roomName),
    };
  }

  const response = await dailyFetch<DailyRoomResponse>("/rooms", {
    method: "POST",
    body: JSON.stringify({
      name: roomName,
      properties: {
        enable_recording: DAILY_AUDIO_RECORDING_TYPE,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  });

  return {
    roomName: response.name ?? roomName,
    meetingUrl: response.url ?? buildDailyRoomUrl(response.name ?? roomName),
  };
}

export async function startDailyRecording(meetingUrl: string): Promise<{ recordingId: string | null }> {
  const roomName = getDailyRoomNameFromUrl(meetingUrl);
  if (serverEnv.dailyMockMode) {
    return { recordingId: `mock-recording-${roomName}` };
  }

  const response = await dailyFetch<DailyStartRecordingResponse>(`/rooms/${roomName}/recordings/start`, {
    method: "POST",
    body: JSON.stringify({
      type: DAILY_AUDIO_RECORDING_TYPE,
    }),
  });

  return { recordingId: response.recording_id ?? null };
}

export async function stopDailyRecording(meetingUrl: string): Promise<void> {
  const roomName = getDailyRoomNameFromUrl(meetingUrl);
  if (serverEnv.dailyMockMode) {
    void roomName;
    return;
  }

  await dailyFetch(`/rooms/${roomName}/recordings/stop`, {
    method: "POST",
    body: JSON.stringify({
      type: DAILY_AUDIO_RECORDING_TYPE,
    }),
  });
}

export async function getDailyRecordingLink(recordingId: string): Promise<string> {
  if (serverEnv.dailyMockMode) {
    return `https://daily.mock/recordings/${encodeURIComponent(recordingId)}.mp4`;
  }

  const response = await dailyFetch<{ download_link?: string; url?: string }>(
    `/recordings/${recordingId}/access-link`
  );
  const url = response.download_link ?? response.url;
  if (!url) {
    throw new Error("DAILY_RECORDING_LINK_MISSING");
  }

  return url;
}

export async function getLatestFinishedDailyRecording(meetingUrl: string): Promise<{
  recordingId: string;
} | null> {
  const roomName = getDailyRoomNameFromUrl(meetingUrl);
  if (serverEnv.dailyMockMode) {
    return { recordingId: `mock-recording-${roomName}` };
  }

  const response = await dailyFetch<DailyRecordingListResponse>(
    `/recordings?room_name=${encodeURIComponent(roomName)}`
  );

  const latest = (response.data ?? [])
    .filter((recording) => recording.status === "finished" && !!recording.id)
    .sort((left, right) => (right.start_ts ?? 0) - (left.start_ts ?? 0))[0];

  if (!latest?.id) {
    return null;
  }

  return {
    recordingId: latest.id,
  };
}

export async function ensureDailyRecordingWebhookHealthy(): Promise<"skipped" | "active" | "created" | "updated"> {
  if (serverEnv.dailyMockMode) {
    return "skipped";
  }

  const targetUrl = getDailyWebhookTargetUrl();
  const expectedSecret = serverEnv.dailyWebhookBearerToken?.trim() ?? null;
  const webhooks = await dailyFetch<DailyWebhookDoc[]>("/webhooks");
  const existing = webhooks.find((webhook) => webhook.url === targetUrl);

  const basePayload: Record<string, unknown> = {
    url: targetUrl,
    eventTypes: DAILY_WEBHOOK_EVENT_TYPES,
    retryType: "exponential",
  };

  if (expectedSecret && isBase64(expectedSecret)) {
    basePayload.hmac = expectedSecret;
  }

  if (!existing?.uuid) {
    await dailyFetch("/webhooks", {
      method: "POST",
      body: JSON.stringify(basePayload),
    });
    return "created";
  }

  const hasRequiredEvents = DAILY_WEBHOOK_EVENT_TYPES.every((eventType) =>
    existing.eventTypes?.includes(eventType)
  );
  const needsUpdate =
    existing.state === "FAILED" ||
    existing.retryType !== "exponential" ||
    !hasRequiredEvents ||
    (basePayload.hmac !== undefined && existing.hmac !== basePayload.hmac);

  if (!needsUpdate) {
    return "active";
  }

  await dailyFetch(`/webhooks/${existing.uuid}`, {
    method: "POST",
    body: JSON.stringify(basePayload),
  });
  return "updated";
}

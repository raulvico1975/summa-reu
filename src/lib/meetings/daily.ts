import crypto from "node:crypto";
import { serverEnv } from "@/src/lib/firebase/env";

type DailyRoomResponse = {
  name?: string;
  url?: string;
};

type DailyStartRecordingResponse = {
  recording_id?: string;
  status?: string;
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
        enable_recording: "cloud",
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
    body: JSON.stringify({}),
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
    body: JSON.stringify({}),
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

export function isAuthorizedDailyWebhook(authHeader: string | null): boolean {
  const expected = serverEnv.dailyWebhookBearerToken;
  if (!expected) {
    return true;
  }

  return authHeader === `Bearer ${expected}`;
}

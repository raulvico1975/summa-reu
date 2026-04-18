import { buildStubMinutes, buildStubTranscript } from "@/src/lib/minutes/stub";
import {
  getMeetingById,
  getOrgById,
  saveMinutes,
  saveTranscript,
  updateMeetingArtifacts,
} from "@/src/lib/db/repo";
import { hasGeminiApiKey } from "@/src/lib/gemini/client";
import { generateMinutesWithGemini } from "@/src/lib/gemini/generateMinutes";
import { getGeminiFallbackModel, getGeminiModel } from "@/src/lib/gemini/selectModel";
import { transcribeWithGemini } from "@/src/lib/gemini/transcribe";
import { serverEnv } from "@/src/lib/firebase/env";
import { renderMinutesMarkdown } from "@/src/lib/minutes/markdown";

const MAX_RECORDING_DOWNLOAD_BYTES = 200 * 1024 * 1024;

type RecordingFetchResult = {
  bytes: Buffer;
  mimeType: string;
};

export type MeetingIngestMode = "mock" | "real";

// Definitive errors today: missing meeting/URL, Gemini absent in real mode, download failure,
// and recordings above the inline limit. Those move the job to "error".
// Retryable errors for a future worker pass: transient provider/network failures while fetching
// Daily or calling Gemini. We do not auto-retry them yet, but the job contract leaves room for it.

function buildMockIngestPayload(input: { meetingId: string; recordingId: string }) {
  const transcriptText = buildStubTranscript({
    meetingId: input.meetingId,
    recordingId: input.recordingId,
    rawText:
      "Mock controlat de Daily per smoke. Presidenta: obrim la sessió. Secretaria: revisarem pressupost i calendari.",
  });
  const minutesJson = buildStubMinutes(transcriptText);
  return {
    transcriptText,
    minutesJson,
    minutesMarkdown: renderMinutesMarkdown(minutesJson),
  };
}

async function fetchRecording(url: string): Promise<RecordingFetchResult> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`MEETING_INGEST_DOWNLOAD_FAILED:${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_RECORDING_DOWNLOAD_BYTES) {
    throw new Error("MEETING_INGEST_RECORDING_TOO_LARGE");
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_RECORDING_DOWNLOAD_BYTES) {
    throw new Error("MEETING_INGEST_RECORDING_TOO_LARGE");
  }

  return {
    bytes: Buffer.from(arrayBuffer),
    mimeType: response.headers.get("content-type") ?? "video/mp4",
  };
}

export async function processMeetingIngestJob(input: {
  meetingId: string;
  recordingId: string;
  recordingUrl?: string | null;
}): Promise<{ mode: MeetingIngestMode; model: string }> {
  const meeting = await getMeetingById(input.meetingId);
  if (!meeting) {
    throw new Error("MEETING_INGEST_MEETING_NOT_FOUND");
  }

  const recordingUrl = input.recordingUrl ?? meeting.recordingUrl;
  if (!recordingUrl) {
    throw new Error("MEETING_INGEST_RECORDING_URL_MISSING");
  }

  if (serverEnv.meetingIngestMockMode) {
    const mock = buildMockIngestPayload({
      meetingId: input.meetingId,
      recordingId: input.recordingId,
    });

    await saveTranscript({
      meetingId: input.meetingId,
      recordingId: input.recordingId,
      status: "done",
      text: mock.transcriptText,
    });

    await saveMinutes({
      meetingId: input.meetingId,
      recordingId: input.recordingId,
      status: "done",
      minutesMarkdown: mock.minutesMarkdown,
      minutesJson: mock.minutesJson,
    });

    await updateMeetingArtifacts({
      meetingId: input.meetingId,
      transcript: mock.transcriptText,
      minutesDraft: mock.minutesMarkdown,
      recordingStatus: "ready",
      recordingUrl,
    });

    console.info("meeting_ingest_job_completed", {
      meetingId: input.meetingId,
      recordingId: input.recordingId,
      orgId: meeting.orgId,
      status: "completed",
      reason: "mock",
    });

    return { mode: "mock", model: "mock-meeting-ingest" };
  }

  if (!hasGeminiApiKey()) {
    throw new Error("MEETING_INGEST_GEMINI_NOT_CONFIGURED");
  }

  let selectedModel = getGeminiFallbackModel();
  selectedModel = await getGeminiModel();

  const org = await getOrgById(meeting.orgId);
  const orgLanguage = org?.language;

  const recording = await fetchRecording(recordingUrl);

  const transcriptText = await transcribeWithGemini({
    model: selectedModel,
    audioBytes: recording.bytes,
    mimeType: recording.mimeType,
    displayName: `meeting-${input.meetingId}-${input.recordingId}`,
  });

  const generated = await generateMinutesWithGemini({
    model: selectedModel,
    transcript: transcriptText,
    language: orgLanguage,
  });

  await saveTranscript({
    meetingId: input.meetingId,
    recordingId: input.recordingId,
    status: "done",
    text: transcriptText,
  });

  await saveMinutes({
    meetingId: input.meetingId,
    recordingId: input.recordingId,
    status: "done",
    minutesMarkdown: generated.minutesMarkdown,
    minutesJson: generated.minutesJson,
  });

  await updateMeetingArtifacts({
    meetingId: input.meetingId,
    transcript: transcriptText,
    minutesDraft: generated.minutesMarkdown,
    recordingStatus: "ready",
    recordingUrl,
  });

  console.info("meeting_ingest_job_completed", {
    meetingId: input.meetingId,
    recordingId: input.recordingId,
    orgId: meeting.orgId,
    status: "completed",
    reason: "real",
  });

  return { mode: "real", model: selectedModel };
}

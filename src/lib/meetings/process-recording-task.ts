import { adminStorage } from "@/src/lib/firebase/admin";
import {
  getRecording,
  saveMinutes,
  saveTranscript,
} from "@/src/lib/db/repo";
import { hasGeminiApiKey } from "@/src/lib/gemini/client";
import { getGeminiFallbackModel, getGeminiModel } from "@/src/lib/gemini/selectModel";
import { transcribeWithGemini } from "@/src/lib/gemini/transcribe";
import { generateMinutesWithGemini } from "@/src/lib/gemini/generateMinutes";
import { buildStubMinutes, buildStubTranscript } from "@/src/lib/minutes/stub";
import { renderMinutesMarkdown } from "@/src/lib/minutes/markdown";

export type RecordingProcessMode = "stub" | "real";

export type RecordingProcessResult = {
  mode: RecordingProcessMode;
  model: string;
  transcriptText: string;
  minutesMarkdown: string;
};

export async function processRecordingTask(input: {
  meetingId: string;
  recordingId: string;
  language?: "ca" | "es";
}): Promise<RecordingProcessResult> {
  const recording = await getRecording({
    meetingId: input.meetingId,
    recordingId: input.recordingId,
  });

  if (!recording) {
    throw new Error("Gravació no trobada");
  }

  const hasKey = hasGeminiApiKey();
  let selectedModel = getGeminiFallbackModel();
  if (hasKey) {
    selectedModel = await getGeminiModel();
  }

  let mode: RecordingProcessMode = "stub";
  let transcriptText = "";

  if (recording.rawText?.trim()) {
    transcriptText = recording.rawText.trim();
  } else if (hasKey && recording.storagePath) {
    try {
      const expectedPrefix = `meetings/${input.meetingId}/recordings/`;
      if (!recording.storagePath.startsWith(expectedPrefix) || recording.storagePath.includes("..")) {
        throw new Error("INVALID_RECORDING_PATH");
      }

      const [bytes] = await adminStorage.bucket().file(recording.storagePath).download();
      const mimeType = recording.mimeType ?? "audio/mpeg";
      transcriptText = await transcribeWithGemini({
        model: selectedModel,
        audioBytes: bytes,
        mimeType,
        displayName: `manual-${input.meetingId}-${input.recordingId}`,
      });
      mode = "real";
    } catch {
      transcriptText = buildStubTranscript({
        meetingId: input.meetingId,
        recordingId: input.recordingId,
        rawText: recording.rawText,
      });
    }
  } else {
    transcriptText = buildStubTranscript({
      meetingId: input.meetingId,
      recordingId: input.recordingId,
      rawText: recording.rawText,
    });
  }

  await saveTranscript({
    meetingId: input.meetingId,
    recordingId: input.recordingId,
    status: "done",
    text: transcriptText,
  });

  let minutesMarkdown = "";

  if (hasKey) {
    try {
      const generated = await generateMinutesWithGemini({
        model: selectedModel,
        transcript: transcriptText,
        language: input.language,
      });

      await saveMinutes({
        meetingId: input.meetingId,
        recordingId: input.recordingId,
        status: "done",
        minutesMarkdown: generated.minutesMarkdown,
        minutesJson: generated.minutesJson,
      });

      minutesMarkdown = generated.minutesMarkdown;
      mode = "real";
    } catch {
      const minutesJson = buildStubMinutes(transcriptText, input.language);
      minutesMarkdown = renderMinutesMarkdown(minutesJson);
      await saveMinutes({
        meetingId: input.meetingId,
        recordingId: input.recordingId,
        status: "done",
        minutesMarkdown,
        minutesJson,
      });
    }
  } else {
    const minutesJson = buildStubMinutes(transcriptText, input.language);
    minutesMarkdown = renderMinutesMarkdown(minutesJson);
    await saveMinutes({
      meetingId: input.meetingId,
      recordingId: input.recordingId,
      status: "done",
      minutesMarkdown,
      minutesJson,
    });
  }

  return {
    mode,
    model: selectedModel,
    transcriptText,
    minutesMarkdown,
  };
}

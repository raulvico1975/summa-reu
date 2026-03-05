"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ref, uploadBytes } from "firebase/storage";
import { clientAuth, clientStorage } from "@/src/lib/firebase/client";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/field";
import { useI18n } from "@/src/i18n/client";

export function RecordingUploader({ meetingId }: { meetingId: string }) {
  const { i18n } = useI18n();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [state, setState] = useState<{ loading: boolean; message?: string; error?: string }>({
    loading: false,
  });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ loading: true });

    try {
      let storagePath = "";
      let mimeType: string | undefined;
      let originalName: string | undefined;

      if (file) {
        const currentUser = clientAuth.currentUser;
        if (!currentUser) {
          throw new Error(i18n.meeting.clientSessionMissing);
        }

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        storagePath = `meetings/${meetingId}/recordings/${Date.now()}-${safeName}`;
        const storageRef = ref(clientStorage, storagePath);
        await uploadBytes(storageRef, file, { contentType: file.type || undefined });

        mimeType = file.type || undefined;
        originalName = file.name;
      }

      const registerRes = await fetch("/api/owner/recordings/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId,
          storagePath,
          rawText,
          mimeType,
          originalName,
        }),
      });

      const registerData = (await registerRes.json()) as { recordingId?: string; error?: string };
      if (!registerRes.ok || !registerData.recordingId) {
        throw new Error(registerData.error ?? i18n.meeting.registerRecordingError);
      }

      const processRes = await fetch("/api/owner/process-recording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId,
          recordingId: registerData.recordingId,
        }),
      });

      const processData = (await processRes.json()) as {
        error?: string;
        mode?: string;
        model?: string;
        queued?: boolean;
        status?: "processing" | "done" | "error";
      };
      if (!processRes.ok) {
        throw new Error(processData.error ?? i18n.meeting.processRecordingError);
      }

      let message: string = i18n.meeting.processingQueued;
      if (processData.queued === false && processData.status === "processing") {
        message = i18n.meeting.processingInProgress;
      } else if (processData.queued === false && processData.status === "done") {
        message = i18n.meeting.processingAlreadyDone;
      } else if (processData.model) {
        message = `${i18n.meeting.processingQueued} (${processData.mode ?? "stub"} · ${processData.model})`;
      }

      setState({
        loading: false,
        message,
      });
      setFile(null);
      setRawText("");
      router.refresh();
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : i18n.poll.unexpectedError,
      });
    }
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">{i18n.meeting.recordingFileLabel}</label>
        <input
          type="file"
          accept="audio/*,video/*"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-700"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {i18n.meeting.recordingNotesLabel}
        </label>
        <Textarea rows={5} value={rawText} onChange={(event) => setRawText(event.target.value)} />
      </div>

      {state.error ? <p className="break-words text-sm text-red-600">{state.error}</p> : null}
      {state.message ? <p className="break-words text-sm text-emerald-700">{state.message}</p> : null}

      <Button
        type="submit"
        disabled={state.loading || (!file && rawText.trim().length === 0)}
        className="w-full sm:w-auto"
      >
        {state.loading ? i18n.meeting.processingNowLabel : i18n.meeting.uploadAndProcess}
      </Button>
    </form>
  );
}

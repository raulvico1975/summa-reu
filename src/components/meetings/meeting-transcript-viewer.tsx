"use client";

import { useMemo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { useI18n } from "@/src/i18n/client";

type CopyState = "idle" | "copied" | "error";

function buildTranscriptChunks(transcript: string): string[] {
  const normalized = transcript
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (normalized.length > 1) {
    return normalized;
  }

  const sentences = transcript
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 3) {
    return [transcript.trim()];
  }

  const chunks: string[] = [];
  for (let index = 0; index < sentences.length; index += 3) {
    chunks.push(sentences.slice(index, index + 3).join(" ").trim());
  }
  return chunks;
}

export function MeetingTranscriptViewer({
  transcript,
}: {
  transcript: string;
}) {
  const { i18n } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const chunks = useMemo(() => buildTranscriptChunks(transcript), [transcript]);
  const visibleChunks = expanded ? chunks : chunks.slice(0, 2);
  const hiddenChunksCount = Math.max(0, chunks.length - visibleChunks.length);
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 180));

  async function copyTranscript() {
    try {
      await navigator.clipboard.writeText(transcript);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2500);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {i18n.meeting.transcriptViewerEyebrow}
          </p>
          <p className="text-sm text-slate-700">{i18n.meeting.transcriptViewerBody}</p>
          <p className="text-sm text-slate-500">
            {i18n.meeting.transcriptViewerMeta
              .replace("{words}", String(wordCount))
              .replace("{minutes}", String(readingMinutes))}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={copyTranscript} className="w-full sm:w-auto">
            {i18n.meeting.copyTranscript}
          </Button>
          {chunks.length > 2 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setExpanded((current) => !current)}
              className="w-full sm:w-auto"
            >
              {expanded ? i18n.meeting.collapseTranscript : i18n.meeting.expandTranscript}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {visibleChunks.map((chunk, index) => (
          <div
            key={`${index}-${chunk.slice(0, 24)}`}
            className="rounded-xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {i18n.meeting.transcriptChunkLabel.replace("{index}", String(index + 1))}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{chunk}</p>
          </div>
        ))}
      </div>

      {!expanded && hiddenChunksCount > 0 ? (
        <p className="text-sm text-slate-500">
          {i18n.meeting.transcriptHiddenChunks.replace("{count}", String(hiddenChunksCount))}
        </p>
      ) : null}

      {copyState === "copied" ? (
        <p className="break-words text-sm text-emerald-700">{i18n.meeting.transcriptCopied}</p>
      ) : null}
      {copyState === "error" ? (
        <p className="break-words text-sm text-red-700">{i18n.meeting.transcriptCopyError}</p>
      ) : null}
    </div>
  );
}

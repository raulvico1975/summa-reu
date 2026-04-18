"use client";

import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/field";
import { useI18n } from "@/src/i18n/client";

type SaveState = {
  loading: boolean;
  message?: string;
  error?: string;
};

type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] };

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? "";

    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({ type: "heading", level: 1, text: line.slice(2).trim() });
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({ type: "heading", level: 2, text: line.slice(3).trim() });
      index += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({ type: "heading", level: 3, text: line.slice(4).trim() });
      index += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index]?.trim() ?? "";
        if (!current.startsWith("- ")) {
          break;
        }
        items.push(current.slice(2).trim());
        index += 1;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index]?.trim() ?? "";
        if (!/^\d+\.\s+/.test(current)) {
          break;
        }
        items.push(current.replace(/^\d+\.\s+/, "").trim());
        index += 1;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index]?.trim() ?? "";
      if (!current) {
        break;
      }
      if (
        current.startsWith("# ") ||
        current.startsWith("## ") ||
        current.startsWith("### ") ||
        current.startsWith("- ") ||
        /^\d+\.\s+/.test(current)
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function MinutesDocumentPreview({ markdown }: { markdown: string }) {
  const blocks = parseMarkdownBlocks(markdown);

  return (
    <div className="rounded-xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-5 text-slate-800">
        {blocks.map((block, index) => {
          if (block.type === "heading") {
            if (block.level === 1) {
              return (
                <h3 key={index} className="text-2xl font-semibold tracking-tight text-slate-950">
                  {block.text}
                </h3>
              );
            }

            if (block.level === 2) {
              return (
                <h4 key={index} className="pt-2 text-lg font-semibold text-slate-900">
                  {block.text}
                </h4>
              );
            }

            return (
              <h5 key={index} className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
                {block.text}
              </h5>
            );
          }

          if (block.type === "unordered-list") {
            return (
              <ul key={index} className="space-y-2 pl-5 text-sm leading-7 text-slate-700 marker:text-slate-400">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ul>
            );
          }

          if (block.type === "ordered-list") {
            return (
              <ol key={index} className="space-y-2 pl-5 text-sm leading-7 text-slate-700 marker:font-medium marker:text-slate-500">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ol>
            );
          }

          return (
            <p key={index} className="text-sm leading-7 text-slate-700">
              {block.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}

export function MinutesEditor({
  meetingId,
  minutesId,
  initialMarkdown,
}: {
  meetingId: string;
  minutesId: string;
  initialMarkdown: string;
}) {
  const { i18n } = useI18n();
  const [value, setValue] = useState(initialMarkdown);
  const [savedValue, setSavedValue] = useState(initialMarkdown);
  const [isEditing, setIsEditing] = useState(false);
  const [state, setState] = useState<SaveState>({ loading: false });
  const hasChanges = value !== savedValue;

  async function onSave() {
    setState({ loading: true });

    try {
      const res = await fetch("/api/owner/minutes/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, minutesId, minutesMarkdown: value }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? i18n.meeting.saveMinutesError);
      }

      setSavedValue(value);
      setIsEditing(false);
      setState({ loading: false, message: i18n.meeting.minutesSaved });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : i18n.poll.unexpectedError,
      });
    }
  }

  function openEditor() {
    setIsEditing(true);
    setState((current) => ({ loading: false, message: current.message }));
  }

  function cancelEditing() {
    setValue(savedValue);
    setIsEditing(false);
    setState((current) => ({ loading: false, message: current.message }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {i18n.meeting.minutesEditorEyebrow}
          </p>
          <p className="text-sm text-slate-700">
            {isEditing ? i18n.meeting.minutesEditorEditingBody : i18n.meeting.minutesEditorReviewBody}
          </p>
          {hasChanges ? (
            <p className="text-sm font-medium text-amber-700">{i18n.meeting.minutesEditorUnsavedChanges}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href="#transcript-section"
            className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100 sm:w-auto"
          >
            {i18n.meeting.compareWithTranscript}
          </a>
          {isEditing ? (
            <>
              <Button type="button" variant="secondary" onClick={cancelEditing} className="w-full sm:w-auto">
                {i18n.meeting.cancelMinutesEditing}
              </Button>
              <Button type="button" onClick={onSave} disabled={state.loading || !hasChanges} className="w-full sm:w-auto">
                {state.loading ? i18n.meeting.savingMinutes : i18n.meeting.saveMinutes}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={openEditor} className="w-full sm:w-auto">
              {i18n.meeting.editMinutes}
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <Textarea
            rows={16}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setState((current) => ({ loading: false, message: current.message }));
            }}
            className="min-h-[26rem] font-mono text-sm leading-6"
          />
          <p className="text-sm text-slate-600">{i18n.meeting.minutesEditorEditingHint}</p>
        </div>
      ) : (
        <MinutesDocumentPreview markdown={savedValue} />
      )}

      {state.error ? <p className="break-words text-sm text-red-600">{state.error}</p> : null}
      {state.message ? <p className="break-words text-sm text-emerald-700">{state.message}</p> : null}
    </div>
  );
}

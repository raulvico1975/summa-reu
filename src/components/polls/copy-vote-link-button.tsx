"use client";

import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { ca } from "@/src/i18n/ca";
import { cn } from "@/src/lib/cn";

type CopyState = "idle" | "copied" | "error";

export function CopyVoteLinkButton({ slug, className }: { slug: string; className?: string }) {
  const [state, setState] = useState<CopyState>("idle");

  async function handleCopy() {
    const voteUrl = new URL(`/p/${slug}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(voteUrl);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 2500);
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button type="button" variant="secondary" onClick={handleCopy}>
        {ca.poll.copyVoteLink}
      </Button>
      {state === "copied" ? <span className="text-xs text-emerald-700">{ca.poll.voteLinkCopied}</span> : null}
      {state === "error" ? <span className="text-xs text-red-700">{ca.poll.voteLinkCopyError}</span> : null}
    </div>
  );
}

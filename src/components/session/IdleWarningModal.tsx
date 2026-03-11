"use client";

import { Button } from "@/src/components/ui/button";

type IdleWarningModalProps = {
  open: boolean;
  title: string;
  description: string;
  continueLabel: string;
  onContinue: () => void;
};

export default function IdleWarningModal({
  open,
  title,
  description,
  continueLabel,
  onContinue,
}: IdleWarningModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="idle-warning-title"
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg"
      >
        <h2 id="idle-warning-title" className="mb-2 text-lg font-semibold text-slate-900">
          {title}
        </h2>

        <p className="mb-4 text-sm text-slate-600">{description}</p>

        <Button onClick={onContinue} autoFocus>
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}

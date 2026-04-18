"use client";

import { useState } from "react";
import { Button } from "@/src/components/ui/button";

type Props = {
  label: string;
  loadingLabel: string;
  fallbackError: string;
};

export function ActivateSubscriptionButton({ label, loadingLabel, fallbackError }: Props) {
  const [state, setState] = useState<{ loading: boolean; error?: string }>({
    loading: false,
  });

  async function onActivate() {
    setState({ loading: true });

    try {
      const response = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await response.json()) as { checkoutUrl?: string; error?: string };

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? fallbackError);
      }

      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : fallbackError,
      });
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        className="h-11 w-full rounded-xl text-base font-semibold"
        disabled={state.loading}
        onClick={onActivate}
      >
        {state.loading ? loadingLabel : label}
      </Button>
      {state.error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 break-words text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect } from "react";

type ClientIssuePayload = {
  kind: "error" | "unhandledrejection";
  page: string;
  message: string;
};

function postIssue(payload: ClientIssuePayload) {
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/public/error-report", blob);
    return;
  }

  void fetch("/api/public/error-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}

function readPagePath(): string {
  if (typeof window === "undefined") {
    return "/";
  }

  return `${window.location.pathname}${window.location.search}`;
}

export function ErrorMonitor() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      postIssue({
        kind: "error",
        page: readPagePath(),
        message: event.message?.slice(0, 280) ?? "Error no identificat",
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason =
        typeof event.reason === "string"
          ? event.reason
          : event.reason instanceof Error
            ? event.reason.message
            : "Promesa rebutjada sense detall";

      postIssue({
        kind: "unhandledrejection",
        page: readPagePath(),
        message: reason.slice(0, 280),
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

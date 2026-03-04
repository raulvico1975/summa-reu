import { reportServerUnexpectedError } from "@/src/lib/monitoring/report";

declare global {
  var __summaBoardMonitoringHooksRegistered: boolean | undefined;
}

export async function register() {
  if (typeof process === "undefined" || typeof process.on !== "function") {
    return;
  }

  if (globalThis.__summaBoardMonitoringHooksRegistered) {
    return;
  }

  globalThis.__summaBoardMonitoringHooksRegistered = true;

  process.on("unhandledRejection", (reason) => {
    void reportServerUnexpectedError({
      stage: "process.unhandledRejection",
      error: reason,
      dedupeKey: "process.unhandledRejection",
    });
  });

  process.on("uncaughtException", (error) => {
    void reportServerUnexpectedError({
      stage: "process.uncaughtException",
      error,
      dedupeKey: "process.uncaughtException",
    });
  });
}

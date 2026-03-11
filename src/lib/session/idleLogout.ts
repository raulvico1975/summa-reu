"use client";

type IdleConfig = {
  idleMs: number;
  warningMs: number;
  onWarning: () => void;
  onLogout: () => void;
  onActivity?: () => void;
};

type IdleController = {
  reset: () => void;
  stop: () => void;
};

export function startIdleLogout(config: IdleConfig): IdleController {
  let idleTimer: number | undefined;
  let warningTimer: number | undefined;
  let warningShown = false;

  const clearTimers = () => {
    if (idleTimer) {
      window.clearTimeout(idleTimer);
    }
    if (warningTimer) {
      window.clearTimeout(warningTimer);
    }
  };

  const reset = () => {
    clearTimers();

    if (warningShown) {
      warningShown = false;
      config.onActivity?.();
    }

    warningTimer = window.setTimeout(() => {
      warningShown = true;
      config.onWarning();
    }, config.warningMs);

    idleTimer = window.setTimeout(() => {
      config.onLogout();
    }, config.idleMs);
  };

  const events = ["mousemove", "keydown", "mousedown", "scroll", "touchstart"] as const;

  events.forEach((eventName) => window.addEventListener(eventName, reset));
  reset();

  return {
    reset,
    stop: () => {
      events.forEach((eventName) => window.removeEventListener(eventName, reset));
      clearTimers();
    },
  };
}

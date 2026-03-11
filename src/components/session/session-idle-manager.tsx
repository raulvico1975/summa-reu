"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/src/i18n/client";
import IdleWarningModal from "@/src/components/session/IdleWarningModal";
import { startIdleLogout } from "@/src/lib/session/idleLogout";
import { SESSION_IDLE_MS, SESSION_WARNING_MS } from "@/src/lib/session/sessionConfig";

type SessionIdleManagerProps = {
  enabled: boolean;
};

function submitLogoutForm() {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/auth/session-logout";
  form.style.display = "none";
  document.body.appendChild(form);
  form.submit();
}

export function SessionIdleManager({ enabled }: SessionIdleManagerProps) {
  const { i18n } = useI18n();
  const [warningOpen, setWarningOpen] = useState(false);
  const controllerRef = useRef<ReturnType<typeof startIdleLogout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      controllerRef.current?.stop();
      controllerRef.current = null;
      setWarningOpen(false);
      return;
    }

    const controller = startIdleLogout({
      idleMs: SESSION_IDLE_MS,
      warningMs: SESSION_WARNING_MS,
      onWarning: () => setWarningOpen(true),
      onActivity: () => setWarningOpen(false),
      onLogout: () => {
        setWarningOpen(false);
        submitLogoutForm();
      },
    });

    controllerRef.current = controller;

    return () => {
      controller.stop();
      controllerRef.current = null;
    };
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <IdleWarningModal
      open={warningOpen}
      title={i18n.session.idleWarningTitle}
      description={i18n.session.idleWarningDescription}
      continueLabel={i18n.session.continueSession}
      onContinue={() => {
        setWarningOpen(false);
        controllerRef.current?.reset();
      }}
    />
  );
}

"use client"

import * as React from "react"
import { CheckCircle2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { type ToasterToast, useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

const CENTERED_SUCCESS_DURATION = 4000

function CenteredToastCard({
  toast,
  onDismiss,
}: {
  toast: ToasterToast
  onDismiss: () => void
}) {
  React.useEffect(() => {
    if (toast.open === false) {
      return
    }

    const duration =
      typeof toast.duration === "number"
        ? toast.duration
        : CENTERED_SUCCESS_DURATION

    if (duration <= 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      onDismiss()
    }, duration)

    return () => window.clearTimeout(timeoutId)
  }, [onDismiss, toast.duration, toast.open])

  if (toast.open === false) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className={cn(
          "pointer-events-auto w-full max-w-lg rounded-[24px] border bg-white/98 p-5 shadow-[0_28px_90px_rgba(15,23,42,0.18)] backdrop-blur-sm",
          toast.variant === "destructive" ? "border-red-200" : "border-emerald-200"
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              toast.variant === "destructive"
                ? "bg-red-100 text-red-700"
                : "bg-emerald-100 text-emerald-700"
            )}
          >
            <CheckCircle2 className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="grid gap-1">
              {toast.title ? (
                <div className="text-base font-semibold text-slate-950">
                  {toast.title}
                </div>
              ) : null}
              {toast.description ? (
                <div className="text-sm leading-6 text-slate-600">
                  {toast.description}
                </div>
              ) : null}
            </div>

            {toast.action ? <div className="pt-3">{toast.action}</div> : null}
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
            aria-label="Tancar notificacio"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function Toaster() {
  const { toasts, dismiss } = useToast()
  const centeredToasts = toasts.filter(
    (toast) => toast.presentation === "centered-success"
  )
  const standardToasts = toasts.filter(
    (toast) => toast.presentation !== "centered-success"
  )

  return (
    <ToastProvider>
      {standardToasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      {centeredToasts.map((toast) => (
        <CenteredToastCard
          key={toast.id}
          toast={toast}
          onDismiss={() => dismiss(toast.id)}
        />
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}

"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { useTranslations } from "@/i18n"
import { cn } from "@/lib/utils"

const Dialog: React.FC<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>> = ({
  onOpenChange,
  children,
  ...props
}) => {
  const handleOpenChange = React.useCallback((open: boolean) => {
    if (open) {
      // Evita que popovers/dropdowns previs quedin per sobre de la modal.
      const openPopovers = document.querySelectorAll('[data-radix-popper-content-wrapper]');
      openPopovers.forEach((el) => {
        if (el instanceof HTMLElement) {
          el.style.display = 'none';
        }
      });
    }
    if (!open) {
      // 1. Treure focus immediatament
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      // 2. Marcar el contingut com inert per evitar conflictes aria-hidden
      const content = document.querySelector('[data-state="open"][role="dialog"]');
      if (content instanceof HTMLElement) {
        content.inert = true;
      }
      // 3. Tancar qualsevol popover/select obert dins la modal
      const openPopovers = document.querySelectorAll('[data-radix-popper-content-wrapper]');
      openPopovers.forEach((el) => {
        if (el instanceof HTMLElement) {
          el.style.display = 'none';
        }
      });
    }
    onOpenChange?.(open);
  }, [onOpenChange]);

  return (
    <DialogPrimitive.Root onOpenChange={handleOpenChange} {...props}>
      {children}
    </DialogPrimitive.Root>
  );
};
Dialog.displayName = "Dialog";

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

interface DialogOverlayProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> {
  guidedMode?: boolean;
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  DialogOverlayProps
>(({ className, guidedMode, style, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[100] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      !guidedMode && "bg-black/80",
      className
    )}
    style={guidedMode ? {
      ...style,
      background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.55) 100%)',
    } : style}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  guidedMode?: boolean;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, guidedMode, ...props }, ref) => {
  const { tr } = useTranslations()

  return (
    <DialogPortal>
      <DialogOverlay guidedMode={guidedMode} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-[101] grid w-[min(calc(100vw-2rem),32rem)] max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-x-hidden overflow-y-auto overscroll-y-contain border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:w-[min(calc(100vw-3rem),32rem)] sm:rounded-lg",
          guidedMode && "shadow-[0_0_40px_rgba(255,255,255,0.08)] ring-1 ring-white/10",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 z-10 rounded-md bg-background/90 p-1.5 opacity-70 ring-offset-background backdrop-blur-sm transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">{tr('common.close', 'Close')}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex min-w-0 flex-col space-y-1.5 pr-12 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "min-w-0 break-words text-lg font-semibold leading-snug tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("min-w-0 break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}

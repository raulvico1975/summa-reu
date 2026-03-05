import type { HTMLAttributes } from "react";
import { cn } from "@/src/lib/cn";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-center text-xs font-medium leading-tight whitespace-normal break-words text-slate-700",
        className
      )}
      {...props}
    />
  );
}

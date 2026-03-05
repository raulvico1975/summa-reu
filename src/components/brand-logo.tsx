import type { HTMLAttributes } from "react";

type BrandLogoProps = {
  compact?: boolean;
} & HTMLAttributes<HTMLSpanElement>;

export function BrandLogo({ compact = false, className = "", ...props }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`.trim()} {...props}>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className={compact ? "h-7 w-7 text-sky-500" : "h-8 w-8 text-sky-500"}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 8.5c-2 2-4 2.5-6 2.5s-4-.5-6-2.5" />
        <path d="M7 15.5c2-2 4-2.5 6-2.5s4 .5 6 2.5" />
        <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />
      </svg>
      {compact ? null : (
        <span className="block text-base font-semibold tracking-tight text-slate-900">Summa Social</span>
      )}
    </span>
  );
}

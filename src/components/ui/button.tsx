import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/src/lib/cn";

type ButtonVariant = "primary" | "secondary" | "destructive" | "outline";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-sky-500 text-white hover:bg-sky-600",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
  destructive: "bg-red-500 text-white hover:bg-red-600",
  outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100",
};

export function Button({ className, variant = "primary", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex max-w-full items-center justify-center rounded-md px-4 py-2 text-center text-sm font-medium leading-tight whitespace-normal break-words transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

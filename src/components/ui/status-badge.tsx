import { Badge } from "@/src/components/ui/badge";
import type { I18nCa } from "@/src/i18n/ca";

type Status =
  | "open"
  | "closed"
  | "uploaded"
  | "processing"
  | "done"
  | "error"
  | "pending"
  | "none"
  | "recording"
  | "stopping"
  | "ready";

const styleByStatus: Record<Status, string> = {
  open: "border-sky-200 bg-sky-50 text-sky-700",
  closed: "border-slate-300 bg-slate-100 text-slate-700",
  uploaded: "border-amber-200 bg-amber-50 text-amber-700",
  processing: "border-indigo-200 bg-indigo-50 text-indigo-700",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-red-200 bg-red-50 text-red-700",
  pending: "border-slate-300 bg-slate-100 text-slate-700",
  none: "border-slate-300 bg-slate-100 text-slate-700",
  recording: "border-rose-200 bg-rose-50 text-rose-700",
  stopping: "border-amber-200 bg-amber-50 text-amber-700",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function StatusBadge({
  status,
  labels,
}: {
  status: Status;
  labels: I18nCa["status"];
}) {
  return <Badge className={styleByStatus[status]}>{labels[status]}</Badge>;
}

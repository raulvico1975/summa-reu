import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { listPollsByOrg } from "@/src/lib/db/repo";
import { formatDateTime } from "@/src/lib/dates";
import { requireOwnerPage } from "@/src/lib/ui/owner-page";
import { ca } from "@/src/i18n/ca";

export default async function DashboardPage() {
  const owner = await requireOwnerPage();
  const polls = await listPollsByOrg(owner.orgId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{ca.dashboard.title}</h1>
        <p className="mt-1 break-words text-sm text-slate-600">{owner.orgName}</p>
      </div>

      {polls.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-slate-600">{ca.dashboard.empty}</CardContent>
        </Card>
      ) : (
        polls.map((poll) => (
          <Card key={poll.id}>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="break-words text-base font-semibold leading-tight text-slate-900">{poll.title}</h2>
                <p className="mt-1 break-all text-xs text-slate-500">/{poll.slug}</p>
              </div>
              <StatusBadge status={poll.status} />
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                {ca.dashboard.createdLabel}: {formatDateTime(poll.createdAt)}
              </p>
              <div className="grid w-full grid-cols-2 gap-2 text-sm sm:flex sm:w-auto">
                <Link
                  href={`/polls/${poll.id}`}
                  className="rounded-md bg-sky-500 px-3 py-2 text-center font-medium text-white transition-colors hover:bg-sky-600"
                >
                  {ca.dashboard.manage}
                </Link>
                <Link
                  href={`/p/${poll.slug}/results`}
                  className="rounded-md border border-slate-300 px-3 py-2 text-center font-medium transition-colors hover:bg-slate-50"
                >
                  {ca.dashboard.results}
                </Link>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

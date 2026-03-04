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
        <h1 className="text-2xl font-semibold">{ca.dashboard.title}</h1>
        <p className="text-sm text-slate-600">{owner.orgName}</p>
      </div>

      {polls.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-slate-600">{ca.dashboard.empty}</CardContent>
        </Card>
      ) : (
        polls.map((poll) => (
          <Card key={poll.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">{poll.title}</h2>
                <p className="text-xs text-slate-500">/{poll.slug}</p>
              </div>
              <StatusBadge status={poll.status} />
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {ca.dashboard.createdLabel}: {formatDateTime(poll.createdAt)}
              </p>
              <div className="flex gap-2 text-sm">
                <Link href={`/polls/${poll.id}`} className="rounded-md bg-sky-500 px-3 py-1.5 text-white">
                  {ca.dashboard.manage}
                </Link>
                <Link href={`/p/${poll.slug}/results`} className="rounded-md border border-slate-300 px-3 py-1.5">
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

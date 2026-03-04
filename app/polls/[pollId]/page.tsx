import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { ResultsTable } from "@/src/components/polls/results-table";
import { ClosePollForm } from "@/src/components/polls/close-poll-form";
import { getPollById, getPollVoteRows } from "@/src/lib/db/repo";
import { formatDateTime } from "@/src/lib/dates";
import { requireOwnerPage } from "@/src/lib/ui/owner-page";

export default async function PollManagePage({ params }: { params: Promise<{ pollId: string }> }) {
  const owner = await requireOwnerPage();
  const { pollId } = await params;

  const poll = await getPollById(pollId);
  if (!poll || poll.orgId !== owner.orgId) {
    notFound();
  }

  const rows = await getPollVoteRows(poll.id);
  const options = poll.options.map((option) => ({ id: option.id, label: formatDateTime(option.startsAt) }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{poll.title}</h1>
          <p className="text-sm text-slate-600">/{poll.slug}</p>
        </div>
        <StatusBadge status={poll.status} />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Resultats</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResultsTable options={options} rows={rows} />
          <div className="flex flex-wrap gap-2 text-sm">
            <Link className="rounded-md border border-slate-300 px-3 py-1.5" href={`/p/${poll.slug}`}>
              Vista pública
            </Link>
            <Link className="rounded-md border border-slate-300 px-3 py-1.5" href={`/p/${poll.slug}/results`}>
              Resultats públics
            </Link>
          </div>
        </CardContent>
      </Card>

      {poll.status === "open" ? (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Tancar votació</h2>
          </CardHeader>
          <CardContent>
            <ClosePollForm pollId={poll.id} options={options} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

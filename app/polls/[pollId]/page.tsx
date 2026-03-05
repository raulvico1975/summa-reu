import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { ResultsTable } from "@/src/components/polls/results-table";
import { ClosePollForm } from "@/src/components/polls/close-poll-form";
import { CopyVoteLinkButton } from "@/src/components/polls/copy-vote-link-button";
import { ca } from "@/src/i18n/ca";
import { getMeetingIdByPollId, getPollById, getPollVoteRows } from "@/src/lib/db/repo";
import { formatDateTime } from "@/src/lib/dates";
import { requireOwnerPage } from "@/src/lib/ui/owner-page";

export default async function PollManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ pollId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const owner = await requireOwnerPage();
  const { pollId } = await params;
  const { created } = await searchParams;
  const showCreatedState = created === "1";

  const poll = await getPollById(pollId);
  if (!poll || poll.orgId !== owner.orgId) {
    notFound();
  }

  const [rows, meetingId] = await Promise.all([
    getPollVoteRows(poll.id),
    poll.status === "closed" ? getMeetingIdByPollId(poll.id) : Promise.resolve(null),
  ]);

  const options = poll.options.map((option) => ({ id: option.id, label: formatDateTime(option.startsAt) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {poll.title}
          </h1>
          <p className="mt-1 break-all text-sm text-slate-600">/{poll.slug}</p>
        </div>
        <StatusBadge status={poll.status} />
      </div>

      <Card className={showCreatedState ? "border-emerald-200 bg-emerald-50/40" : undefined}>
        <CardHeader>
          <h2 className="text-base font-semibold">
            {showCreatedState ? ca.poll.justCreatedTitle : ca.poll.nextStepsTitle}
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {showCreatedState ? <p className="text-sm text-slate-700">{ca.poll.justCreatedHint}</p> : null}
          <div className="grid gap-2 text-sm text-slate-700">
            <p>{ca.poll.stepShare}</p>
            <p>{ca.poll.stepCollect}</p>
            <p>{poll.status === "open" ? ca.poll.stepClose : ca.poll.stepClosed}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
              {ca.poll.votesReceived}: {rows.length}
            </span>
            {meetingId ? (
              <Link
                className="rounded-md border border-slate-300 px-3 py-2 text-center font-medium transition-colors hover:bg-slate-50"
                href={`/meetings/${meetingId}`}
              >
                {ca.poll.openMeeting}
              </Link>
            ) : null}
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <CopyVoteLinkButton slug={poll.slug} />
            <Link
              className="rounded-md bg-sky-500 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-sky-600"
              href={`/p/${poll.slug}/results`}
            >
              {ca.poll.openPublicResults}
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{ca.poll.results}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResultsTable options={options} rows={rows} />
          <div className="grid gap-2 text-sm sm:flex sm:flex-wrap">
            <CopyVoteLinkButton slug={poll.slug} />
            <Link
              className="rounded-md border border-slate-300 px-3 py-2 text-center font-medium transition-colors hover:bg-slate-100"
              href={`/p/${poll.slug}/results`}
            >
              {ca.poll.openPublicResults}
            </Link>
          </div>
        </CardContent>
      </Card>

      {poll.status === "open" ? (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">{ca.poll.closePoll}</h2>
          </CardHeader>
          <CardContent>
            <ClosePollForm pollId={poll.id} options={options} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { ResultsTable } from "@/src/components/polls/results-table";
import { ca } from "@/src/i18n/ca";
import { getPollBySlug, getPollVoteRows } from "@/src/lib/db/repo";
import { formatDateTime } from "@/src/lib/dates";
import { getOwnerFromServerCookies } from "@/src/lib/firebase/auth";

export default async function PublicPollResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [poll, owner] = await Promise.all([getPollBySlug(slug), getOwnerFromServerCookies()]);

  if (!poll) {
    notFound();
  }

  const rows = await getPollVoteRows(poll.id);
  const options = poll.options.map((option) => ({ id: option.id, label: formatDateTime(option.startsAt) }));

  const totals = options.map((option) => ({
    ...option,
    count: rows.reduce(
      (acc, row) => acc + (row.availabilityByOptionId[option.id] ? 1 : 0),
      0
    ),
  }));

  const ranked = [...totals].sort((a, b) => b.count - a.count);
  const hasVotes = rows.length > 0;
  const topCount = ranked[0]?.count ?? 0;
  const topOptions = ranked.filter((item) => item.count === topCount);
  const isTie = hasVotes && topOptions.length > 1;
  const highlightedOptionIds = new Set(hasVotes ? topOptions.map((item) => item.id) : []);
  const isOwner = owner?.orgId === poll.orgId;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {ca.poll.resultsTitlePrefix}: {poll.title}
        </h1>
        <StatusBadge status={poll.status} />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{ca.poll.rankedOptions}</h2>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {ranked.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                highlightedOptionIds.has(item.id) ? "border-sky-200 bg-sky-50" : "border-slate-200"
              }`}
            >
              <span>{item.label}</span>
              <span className="font-medium">
                {item.count} {ca.poll.availableCountSuffix}
              </span>
            </div>
          ))}

          {!hasVotes ? <p className="pt-2 text-sm text-slate-600">{ca.poll.noVotesYet}</p> : null}
          {hasVotes && isTie ? (
            <p className="pt-2 text-sm text-sky-700">
              {ca.poll.bestOptionsTie}: {topOptions.map((item) => item.label).join(" · ")}
            </p>
          ) : null}
          {hasVotes && !isTie ? (
            <p className="pt-2 text-sm text-sky-700">
              {ca.poll.bestOption}: {topOptions[0].label}
            </p>
          ) : null}

          {isOwner && poll.status === "open" ? (
            <Link href={`/polls/${poll.id}`} className="inline-block pt-2 text-sm font-medium text-sky-700 hover:underline">
              {ca.poll.closePollLink}
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{ca.poll.votesTable}</h2>
        </CardHeader>
        <CardContent>
          <ResultsTable options={options} rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}

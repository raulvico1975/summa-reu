import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { ResultsTable } from "@/src/components/polls/results-table";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { getPollBySlug, getPollVoteRows } from "@/src/lib/db/repo";
import { formatDateTime } from "@/src/lib/dates";
import { getOwnerFromServerCookies } from "@/src/lib/firebase/auth";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";
import { localizedPublicMetadata } from "@/src/lib/seo";

function getPollDisplayStatus(status: "open" | "closing" | "closed" | "close_failed") {
  if (status === "closing") {
    return "processing";
  }

  if (status === "close_failed") {
    return "error";
  }

  return status;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { locale, i18n } = await getRequestI18n();
  const { slug } = await params;
  const poll = await getPollBySlug(slug);

  return localizedPublicMetadata({
    locale,
    path: `/p/${slug}/results`,
    title: poll ? `${i18n.poll.resultsTitlePrefix}: ${poll.title}` : i18n.poll.resultsTitlePrefix,
    description: i18n.poll.rankedOptions,
    robots: {
      index: false,
      follow: false,
    },
  });
}

export default async function PublicPollResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { locale, i18n } = await getRequestI18n();
  const { slug } = await params;
  const [poll, owner] = await Promise.all([getPollBySlug(slug), getOwnerFromServerCookies()]);

  if (!poll) {
    notFound();
  }

  const rows = await getPollVoteRows(poll.id, i18n.poll.participant);
  const options = poll.options.map((option) => ({
    id: option.id,
    label: formatDateTime(option.startsAt, locale),
  }));

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
  const leadingOptionText =
    !hasVotes
      ? i18n.poll.noVotesYet
      : isTie
        ? `${i18n.poll.bestOptionsTie}: ${topOptions.map((item) => item.label).join(" · ")}`
        : `${i18n.poll.bestOption}: ${topOptions[0].label}`;
  const statusText = i18n.status[getPollDisplayStatus(poll.status)];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {i18n.poll.resultsTitlePrefix}: {poll.title}
        </h1>
        <StatusBadge status={getPollDisplayStatus(poll.status)} labels={i18n.status} />
      </div>

      <Card className="overflow-hidden border-slate-900 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-xl">
        <CardContent className="grid gap-6 py-5 sm:grid-cols-[minmax(0,1fr)_18rem] sm:items-end sm:py-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
              {i18n.poll.resultsSummaryTitle}
            </p>
            <p className="text-sm leading-6 text-slate-300">{i18n.poll.resultsSummaryHint}</p>
            {isOwner && poll.status === "open" ? (
              <Link
                href={withLocalePath(locale, `/polls/${poll.id}`)}
                className="inline-flex rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
              >
                {i18n.poll.closePollLink}
              </Link>
            ) : null}
          </div>
          <div className="grid gap-3">
            <div className="rounded-xl bg-white/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{i18n.poll.summaryVotes}</p>
              <p className="mt-1 text-2xl font-semibold text-white">{rows.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{i18n.poll.summaryLeader}</p>
              <p className="mt-1 break-words text-sm font-medium text-white">{leadingOptionText}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{i18n.poll.summaryStatus}</p>
              <p className="mt-1 text-sm font-medium text-white">{statusText}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <h2 className="text-base font-semibold">{i18n.poll.rankedOptions}</h2>
          <p className="text-sm text-slate-600">{i18n.poll.resultsSummaryHint}</p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {ranked.map((item) => {
            const fillWidth = hasVotes && topCount > 0 ? Math.max((item.count / topCount) * 100, item.count > 0 ? 12 : 0) : 0;

            return (
              <div
                key={item.id}
                className={`rounded-xl border p-4 ${
                  highlightedOptionIds.has(item.id) ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="break-words font-medium text-slate-900">{item.label}</span>
                  <div className="flex items-center gap-2">
                    {highlightedOptionIds.has(item.id) ? (
                      <Badge className="border-sky-200 bg-sky-100 text-sky-700">
                        {hasVotes && isTie ? i18n.poll.bestOptionsTie : i18n.poll.bestOption}
                      </Badge>
                    ) : null}
                    <span className="shrink-0 font-semibold text-slate-900">
                      {item.count} {i18n.poll.availableCountSuffix}
                    </span>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${highlightedOptionIds.has(item.id) ? "bg-sky-500" : "bg-slate-400"}`}
                    style={{ width: `${fillWidth}%` }}
                  />
                </div>
              </div>
            );
          })}

          {!hasVotes ? <p className="pt-1 text-sm text-slate-600">{i18n.poll.noVotesYet}</p> : null}
          {hasVotes ? <p className="pt-1 text-xs text-slate-500">{i18n.poll.votesReceived}: {rows.length}</p> : null}

          {isOwner && poll.status === "open" ? (
            <div className="pt-2">
              <Link
                href={withLocalePath(locale, `/polls/${poll.id}`)}
                className="text-sm font-medium text-sky-700 hover:underline"
              >
                {i18n.poll.closePollLink}
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
      {hasVotes ? (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">{i18n.poll.votesTable}</h2>
          </CardHeader>
          <CardContent>
            <ResultsTable options={options} rows={rows} i18n={i18n} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

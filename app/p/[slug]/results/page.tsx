import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { getPollBySlug, getPollVoteRows } from "@/src/lib/db/repo";
import { formatDateTime } from "@/src/lib/dates";
import { getOwnerFromServerCookies } from "@/src/lib/firebase/auth";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";
import { localizedPublicMetadata } from "@/src/lib/seo";

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {i18n.poll.resultsTitlePrefix}: {poll.title}
        </h1>
        <StatusBadge status={poll.status} labels={i18n.status} />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{i18n.poll.rankedOptions}</h2>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {ranked.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col items-start gap-1 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${
                highlightedOptionIds.has(item.id) ? "border-sky-200 bg-sky-50" : "border-slate-200"
              }`}
            >
              <span className="break-words">{item.label}</span>
              <span className="font-medium">
                {item.count} {i18n.poll.availableCountSuffix}
              </span>
            </div>
          ))}

          {!hasVotes ? <p className="pt-2 text-sm text-slate-600">{i18n.poll.noVotesYet}</p> : null}
          {hasVotes && isTie ? (
            <p className="break-words pt-2 text-sm text-sky-700">
              {i18n.poll.bestOptionsTie}: {topOptions.map((item) => item.label).join(" · ")}
            </p>
          ) : null}
          {hasVotes && !isTie ? (
            <p className="break-words pt-2 text-sm text-sky-700">
              {i18n.poll.bestOption}: {topOptions[0].label}
            </p>
          ) : null}
          {hasVotes ? (
            <p className="pt-1 text-xs text-slate-500">
              {i18n.poll.votesReceived}: {rows.length}
            </p>
          ) : null}

          {isOwner && poll.status === "open" ? (
            <Link
              href={withLocalePath(locale, `/polls/${poll.id}`)}
              className="inline-block pt-2 text-sm font-medium text-sky-700 hover:underline"
            >
              {i18n.poll.closePollLink}
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

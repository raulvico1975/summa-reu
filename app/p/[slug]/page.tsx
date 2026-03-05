import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { VoteForm } from "@/src/components/polls/vote-form";
import { ca } from "@/src/i18n/ca";
import { getPollBySlug } from "@/src/lib/db/repo";
import { formatDateTime } from "@/src/lib/dates";

export default async function PublicPollPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const poll = await getPollBySlug(slug);

  if (!poll) {
    notFound();
  }

  const options = poll.options.map((option) => ({ id: option.id, label: formatDateTime(option.startsAt) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {poll.title}
          </h1>
          <p className="mt-1 break-words text-sm text-slate-600">{poll.description}</p>
        </div>
        <StatusBadge status={poll.status} />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{ca.poll.sectionVoting}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <VoteForm slug={slug} options={options} disabled={poll.status !== "open"} />
          <Link href={`/p/${slug}/results`} className="text-sm font-medium text-sky-700 hover:underline">
            {ca.poll.viewResults}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

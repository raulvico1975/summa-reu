import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { DeleteMeetingButton } from "@/src/components/meetings/delete-meeting-button";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { listPollsByOrg } from "@/src/lib/db/repo";
import { formatDateTime } from "@/src/lib/dates";
import { getOwnerMeetings } from "@/src/lib/meetings/get-owner-meetings";
import { requireOwnerPage } from "@/src/lib/ui/owner-page";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";

function getPollDisplayStatus(status: "open" | "closing" | "closed" | "close_failed") {
  if (status === "closing") {
    return "processing";
  }

  if (status === "close_failed") {
    return "error";
  }

  return status;
}

export default async function DashboardPage() {
  const { locale, i18n } = await getRequestI18n();
  const owner = await requireOwnerPage();
  const [polls, pastMeetings] = await Promise.all([
    listPollsByOrg(owner.orgId),
    getOwnerMeetings(owner.orgId),
  ]);
  const dashboardHref = withLocalePath(locale, "/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {i18n.dashboard.title}
        </h1>
        <p className="mt-1 break-words text-sm text-slate-600">{owner.orgName}</p>
      </div>

      {polls.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-slate-600">{i18n.dashboard.empty}</CardContent>
        </Card>
      ) : (
        polls.map((poll) => (
          <Card key={poll.id}>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="break-words text-base font-semibold leading-tight text-slate-900">{poll.title}</h2>
                <p className="mt-1 break-all text-xs text-slate-500">/{poll.slug}</p>
              </div>
              <StatusBadge status={getPollDisplayStatus(poll.status)} labels={i18n.status} />
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                {i18n.dashboard.createdLabel}: {formatDateTime(poll.createdAt, locale)}
              </p>
              <div className="grid w-full grid-cols-2 gap-2 text-sm sm:flex sm:w-auto">
                <Link
                  href={withLocalePath(locale, `/polls/${poll.id}`)}
                  className="rounded-md bg-sky-500 px-3 py-2 text-center font-medium text-white transition-colors hover:bg-sky-600"
                >
                  {i18n.dashboard.manage}
                </Link>
                <Link
                  href={withLocalePath(locale, `/p/${poll.slug}/results`)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-center font-medium transition-colors hover:bg-slate-50"
                >
                  {i18n.dashboard.results}
                </Link>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{i18n.dashboard.pastMeetings}</h2>
          <p className="mt-1 text-sm text-slate-600">{i18n.meeting.deleteDescription}</p>
        </div>

        {pastMeetings.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-slate-600">{i18n.dashboard.noPastMeetings}</CardContent>
          </Card>
        ) : (
          pastMeetings.map((meeting) => (
            <Card key={meeting.id}>
              <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <Link
                    href={withLocalePath(locale, `/owner/meetings/${meeting.id}`)}
                    className="block break-words text-base font-semibold text-slate-900 hover:underline"
                  >
                    {meeting.title || i18n.meeting.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {i18n.meeting.meetingDateLabel}: {formatDateTime(meeting.scheduledAt, locale)}
                  </p>
                </div>
                <DeleteMeetingButton meetingId={meeting.id} redirectHref={dashboardHref} />
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}

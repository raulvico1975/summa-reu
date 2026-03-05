import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { NewPollForm } from "@/src/components/polls/new-poll-form";
import { requireOwnerPage } from "@/src/lib/ui/owner-page";
import { getRequestI18n } from "@/src/i18n/server";

export default async function NewPollPage() {
  const { i18n } = await getRequestI18n();
  await requireOwnerPage();

  return (
    <div className="space-y-4">
      <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        {i18n.nav.newPoll}
      </h1>
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{i18n.meeting.sectionCall}</h2>
        </CardHeader>
        <CardContent>
          <NewPollForm />
        </CardContent>
      </Card>
    </div>
  );
}

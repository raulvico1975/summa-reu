import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { NewPollForm } from "@/src/components/polls/new-poll-form";
import { requireOwnerPage } from "@/src/lib/ui/owner-page";

export default async function NewPollPage() {
  await requireOwnerPage();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nova votació</h1>
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Convocatòria</h2>
        </CardHeader>
        <CardContent>
          <NewPollForm />
        </CardContent>
      </Card>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getRequestLocale } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";

export default async function MeetingPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const locale = await getRequestLocale();
  const { meetingId } = await params;
  redirect(withLocalePath(locale, `/owner/meetings/${meetingId}`));
}

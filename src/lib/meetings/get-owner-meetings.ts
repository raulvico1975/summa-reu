import type { MeetingDoc, MeetingRecordingStatus } from "@/src/lib/db/types";
import { normalizeMeetingDoc, isMeetingUsable } from "@/src/lib/db/repo";
import { timestampToDate } from "@/src/lib/dates";
import { adminDb } from "@/src/lib/firebase/admin";

type DashboardMeeting = MeetingDoc & { id: string };

function isActiveMeetingStatus(status: MeetingRecordingStatus | null | undefined): boolean {
  return status === "recording" || status === "processing";
}

export function canDeletePastMeeting(meeting: Pick<MeetingDoc, "scheduledAt" | "recordingStatus">): boolean {
  const scheduledAt = timestampToDate(meeting.scheduledAt);
  if (!scheduledAt) {
    return false;
  }

  return scheduledAt.getTime() < Date.now() && !isActiveMeetingStatus(meeting.recordingStatus);
}

export async function getOwnerMeetings(orgId: string): Promise<DashboardMeeting[]> {
  const snap = await adminDb.collection("meetings").where("orgId", "==", orgId).get();

  const meetings = snap.docs.map((doc) => ({
    id: doc.id,
    ...normalizeMeetingDoc(doc.data() as MeetingDoc),
  }));

  return meetings
    .filter(isMeetingUsable)
    .filter(canDeletePastMeeting)
    .sort((left, right) => {
      const leftTime = timestampToDate(left.scheduledAt)?.getTime() ?? 0;
      const rightTime = timestampToDate(right.scheduledAt)?.getTime() ?? 0;
      return rightTime - leftTime;
    });
}

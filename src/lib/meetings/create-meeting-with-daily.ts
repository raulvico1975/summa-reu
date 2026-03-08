import { adminDb } from "@/src/lib/firebase/admin";
import { createDailyRoom } from "@/src/lib/integrations/daily/create-room";

export type CreateMeetingWithDailyResult = {
  meetingId: string;
  meetingUrl: string | null;
  dailyRoomUrl: string | null;
  dailyRoomName: string | null;
};

export async function createMeetingWithDaily(input: {
  createMeeting: () => Promise<string>;
}): Promise<CreateMeetingWithDailyResult> {
  const meetingId = await input.createMeeting();
  let meetingUrl: string | null = null;
  let dailyRoomUrl: string | null = null;
  let dailyRoomName: string | null = null;

  try {
    const daily = await createDailyRoom(meetingId);
    meetingUrl = daily.roomUrl;
    dailyRoomUrl = daily.roomUrl;
    dailyRoomName = daily.roomName;

    await adminDb.collection("meetings").doc(meetingId).update({
      dailyRoomName,
      dailyRoomUrl,
      meetingUrl,
    });
  } catch (error) {
    console.error("daily_room_create_failed", meetingId);
    console.error(error);
  }

  return {
    meetingId,
    meetingUrl,
    dailyRoomUrl,
    dailyRoomName,
  };
}

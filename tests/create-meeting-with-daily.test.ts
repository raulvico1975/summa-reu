import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import test from "node:test";

process.env.FIREBASE_PROJECT_ID ||= "summa-board";
process.env.FIREBASE_STORAGE_BUCKET ||= "summa-board.firebasestorage.app";
process.env.DAILY_API_KEY ||= "test-daily-key";
process.env.DAILY_DOMAIN ||= "summareu";

const { adminDb } = await import("../src/lib/firebase/admin.ts");
const { createMeetingForOrg } = await import("../src/lib/db/repo.ts");
const { createMeetingWithDaily } = await import("../src/lib/meetings/create-meeting-with-daily.ts");

function buildTitle() {
  return `Meeting ${crypto.randomBytes(6).toString("hex")}`;
}

test("createMeetingWithDaily stores Daily fields when room creation succeeds", async () => {
  const title = buildTitle();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (_input, init) => {
    const payload = JSON.parse(String(init?.body ?? "{}"));

    return new Response(
      JSON.stringify({
        name: payload.name,
        url: `https://summareu.daily.co/${payload.name}`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  };

  try {
    const created = await createMeetingWithDaily({
      createMeeting: () =>
        createMeetingForOrg({
          orgId: "org-success",
          title,
          description: "created from common helper",
          createdBy: "owner-success",
        }),
    });
    const meetingSnap = await adminDb.collection("meetings").doc(created.meetingId).get();
    const meeting = meetingSnap.data();

    assert.equal(meetingSnap.exists, true);
    assert.equal(created.dailyRoomName, `meeting-${created.meetingId}`);
    assert.equal(created.dailyRoomUrl, `https://summareu.daily.co/meeting-${created.meetingId}`);
    assert.equal(created.meetingUrl, created.dailyRoomUrl);
    assert.equal(meeting?.dailyRoomName, created.dailyRoomName);
    assert.equal(meeting?.dailyRoomUrl, created.dailyRoomUrl);
    assert.equal(meeting?.meetingUrl, created.meetingUrl);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createMeetingWithDaily keeps the meeting when Daily room creation fails", async () => {
  const title = buildTitle();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => new Response("boom", { status: 500 });

  try {
    const created = await createMeetingWithDaily({
      createMeeting: () =>
        createMeetingForOrg({
          orgId: "org-failure",
          title,
          description: "created from common helper",
          createdBy: "owner-failure",
        }),
    });
    const meetingSnap = await adminDb.collection("meetings").doc(created.meetingId).get();
    const meeting = meetingSnap.data();

    assert.equal(meetingSnap.exists, true);
    assert.equal(created.dailyRoomName, null);
    assert.equal(created.dailyRoomUrl, null);
    assert.equal(created.meetingUrl, null);
    assert.equal(meeting?.dailyRoomName, null);
    assert.equal(meeting?.dailyRoomUrl, null);
    assert.equal(meeting?.meetingUrl, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createMeetingWithDaily always creates the meeting document first", async () => {
  const title = buildTitle();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => new Response("boom", { status: 500 });

  try {
    const created = await createMeetingWithDaily({
      createMeeting: () =>
        createMeetingForOrg({
          orgId: "org-always",
          title,
          description: "meeting should always exist",
          createdBy: "owner-always",
        }),
    });
    const meetingSnap = await adminDb.collection("meetings").doc(created.meetingId).get();
    const meeting = meetingSnap.data();

    assert.equal(meetingSnap.exists, true);
    assert.equal(meeting?.title, title);
    assert.equal(meeting?.recordingStatus, "none");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("owner meetings create route propagates the exact shape returned by the common helper", async () => {
  const source = await fs.readFile("app/api/owner/meetings/create/route.ts", "utf8");

  assert.equal(
    source.includes("const meeting = await createMeetingRouteDeps.createMeetingWithDaily({"),
    true
  );
  assert.equal(source.includes("return NextResponse.json(meeting);"), true);
  assert.equal(source.includes("return NextResponse.json({ meetingId: meeting.meetingId });"), false);
});

import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { Timestamp } from "firebase-admin/firestore";

process.env.FIREBASE_PROJECT_ID ||= "summa-board";
process.env.FIREBASE_STORAGE_BUCKET ||= "summa-board.firebasestorage.app";
process.env.DAILY_API_KEY ||= "test-daily-key";
process.env.DAILY_DOMAIN ||= "summareu";

const { adminDb } = await import("../src/lib/firebase/admin.ts");
const { closePollCreateMeeting, getMeetingByMeetingUrl } = await import("../src/lib/db/repo.ts");

function buildId(prefix: string) {
  return `${prefix}-${crypto.randomBytes(6).toString("hex")}`;
}

async function seedOpenPoll() {
  const pollId = buildId("poll");
  const optionId = buildId("option");

  await adminDb.collection("polls").doc(pollId).set({
    orgId: "org-test",
    title: `Poll ${pollId}`,
    description: "Poll for closePollCreateMeeting tests",
    timezone: "Europe/Madrid",
    slug: buildId("slug"),
    status: "open",
    winningOptionId: null,
    createdAt: Timestamp.now(),
    closedAt: null,
  });

  await adminDb.collection("polls").doc(pollId).collection("options").doc(optionId).set({
    startsAt: Timestamp.now(),
  });

  return { pollId, optionId };
}

test("closePollCreateMeeting stores Daily room data and mirrors meetingUrl on success", async () => {
  const { pollId, optionId } = await seedOpenPoll();
  const originalFetch = globalThis.fetch;
  let requestedRoomName = "";

  globalThis.fetch = async (_input, init) => {
    const payload = JSON.parse(String(init?.body ?? "{}"));
    requestedRoomName = payload.name;

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
    const meetingId = await closePollCreateMeeting({
      pollId,
      winningOptionId: optionId,
      createdBy: "owner-success",
    });
    const meetingSnap = await adminDb.collection("meetings").doc(meetingId).get();
    const meeting = meetingSnap.data();

    assert.equal(meetingSnap.exists, true);
    assert.equal(requestedRoomName, `meeting-${meetingId}`);
    assert.equal(meeting?.dailyRoomName, requestedRoomName);
    assert.equal(meeting?.dailyRoomUrl, `https://summareu.daily.co/${requestedRoomName}`);
    assert.equal(meeting?.meetingUrl, meeting?.dailyRoomUrl);
    assert.equal(meeting?.recordingStatus, "none");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("closePollCreateMeeting keeps the meeting when Daily room creation fails", async () => {
  const { pollId, optionId } = await seedOpenPoll();
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const errorLogs: unknown[][] = [];

  globalThis.fetch = async () => new Response("boom", { status: 500 });
  console.error = (...args) => {
    errorLogs.push(args);
  };

  try {
    const meetingId = await closePollCreateMeeting({
      pollId,
      winningOptionId: optionId,
      createdBy: "owner-failure",
    });
    const meetingSnap = await adminDb.collection("meetings").doc(meetingId).get();
    const meeting = meetingSnap.data();
    const pollSnap = await adminDb.collection("polls").doc(pollId).get();

    assert.equal(meetingSnap.exists, true);
    assert.equal(meeting?.dailyRoomName, null);
    assert.equal(meeting?.dailyRoomUrl, null);
    assert.equal(meeting?.meetingUrl, null);
    assert.equal(pollSnap.data()?.status, "closed");
    assert.equal(
      errorLogs.some((entry) => entry[0] === "daily_room_create_failed" && entry[1] === meetingId),
      true
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test("legacy meetingUrl consumers keep working after closePollCreateMeeting", async () => {
  const { pollId, optionId } = await seedOpenPoll();
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
    const meetingId = await closePollCreateMeeting({
      pollId,
      winningOptionId: optionId,
      createdBy: "owner-compat",
    });
    const meetingSnap = await adminDb.collection("meetings").doc(meetingId).get();
    const meeting = meetingSnap.data();
    const legacyLookup = await getMeetingByMeetingUrl(meeting?.meetingUrl);

    assert.equal(typeof meeting?.meetingUrl, "string");
    assert.equal(legacyLookup?.id, meetingId);
    assert.equal(legacyLookup?.meetingUrl, meeting?.dailyRoomUrl);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { Timestamp } from "firebase-admin/firestore";

process.env.FIREBASE_PROJECT_ID ||= "summa-board";
process.env.FIREBASE_STORAGE_BUCKET ||= "summa-board.firebasestorage.app";
process.env.DAILY_API_KEY ||= "test-daily-key";
process.env.DAILY_DOMAIN ||= "summareu";

const { adminDb } = await import("../src/lib/firebase/admin.ts");
const {
  closePollCreateMeeting,
  deleteMeetingById,
  getMeetingById,
  getMeetingByMeetingUrl,
} = await import("../src/lib/db/repo.ts");
const {
  canDeletePastMeeting,
  getOwnerMeetings,
} = await import("../src/lib/meetings/get-owner-meetings.ts");

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
    const created = await closePollCreateMeeting({
      pollId,
      winningOptionId: optionId,
      createdBy: "owner-success",
    });
    const meetingSnap = await adminDb.collection("meetings").doc(created.meetingId).get();
    const meeting = meetingSnap.data();

    assert.equal(meetingSnap.exists, true);
    assert.equal(created.meetingId, meetingSnap.id);
    assert.equal(requestedRoomName, `meeting-${created.meetingId}`);
    assert.equal(created.dailyRoomName, requestedRoomName);
    assert.equal(created.dailyRoomUrl, `https://summareu.daily.co/${requestedRoomName}`);
    assert.equal(created.meetingUrl, created.dailyRoomUrl);
    assert.equal(meeting?.dailyRoomName, requestedRoomName);
    assert.equal(meeting?.dailyRoomUrl, `https://summareu.daily.co/${requestedRoomName}`);
    assert.equal(meeting?.meetingUrl, meeting?.dailyRoomUrl);
    assert.equal(meeting?.recordingStatus, "none");
    assert.equal(meeting?.pollId, pollId);
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
    const created = await closePollCreateMeeting({
      pollId,
      winningOptionId: optionId,
      createdBy: "owner-failure",
    });
    const meetingSnap = await adminDb.collection("meetings").doc(created.meetingId).get();
    const meeting = meetingSnap.data();
    const pollSnap = await adminDb.collection("polls").doc(pollId).get();

    assert.equal(meetingSnap.exists, true);
    assert.equal(created.meetingUrl, null);
    assert.equal(created.dailyRoomUrl, null);
    assert.equal(created.dailyRoomName, null);
    assert.equal(meeting?.dailyRoomName, null);
    assert.equal(meeting?.dailyRoomUrl, null);
    assert.equal(meeting?.meetingUrl, null);
    assert.equal(pollSnap.data()?.status, "closed");
    assert.equal(
      errorLogs.some((entry) => entry[0] === "daily_room_create_failed" && entry[1] === created.meetingId),
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
    const created = await closePollCreateMeeting({
      pollId,
      winningOptionId: optionId,
      createdBy: "owner-compat",
    });
    const meetingSnap = await adminDb.collection("meetings").doc(created.meetingId).get();
    const meeting = meetingSnap.data();
    const legacyLookup = await getMeetingByMeetingUrl(meeting?.meetingUrl);

    assert.equal(typeof meeting?.meetingUrl, "string");
    assert.equal(legacyLookup?.id, created.meetingId);
    assert.equal(legacyLookup?.meetingUrl, meeting?.dailyRoomUrl);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getMeetingById returns the latest ingest job without requiring ordered Firestore results", async () => {
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
    const created = await closePollCreateMeeting({
      pollId,
      winningOptionId: optionId,
      createdBy: "owner-ingest",
    });

    await adminDb.collection("meeting_ingest_jobs").doc(buildId("job-old")).set({
      meetingId: created.meetingId,
      orgId: "org-test",
      recordingId: buildId("recording"),
      source: "daily",
      status: "queued",
      recordingUrl: "https://example.com/old.mp4",
      error: null,
      createdAt: 100,
      updatedAt: 100,
    });

    await adminDb.collection("meeting_ingest_jobs").doc(buildId("job-new")).set({
      meetingId: created.meetingId,
      orgId: "org-test",
      recordingId: buildId("recording"),
      source: "daily",
      status: "processing",
      recordingUrl: "https://example.com/new.mp4",
      error: null,
      createdAt: 200,
      updatedAt: 200,
    });

    const meeting = await getMeetingById(created.meetingId);

    assert.equal(meeting?.latestIngestJob?.status, "processing");
    assert.equal(meeting?.latestIngestJob?.recordingUrl, "https://example.com/new.mp4");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deleteMeetingById removes the meeting with its nested assets and ingest jobs", async () => {
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
    const created = await closePollCreateMeeting({
      pollId,
      winningOptionId: optionId,
      createdBy: "owner-delete",
    });

    await adminDb.collection("meetings").doc(created.meetingId).collection("recordings").doc("rec-1").set({
      storagePath: `meetings/${created.meetingId}/recordings/test.mp4`,
      rawText: null,
      mimeType: "video/mp4",
      originalName: "test.mp4",
      status: "done",
      createdAt: Timestamp.now(),
      error: null,
    });
    await adminDb.collection("meetings").doc(created.meetingId).collection("transcripts").doc("rec-1").set({
      recordingId: "rec-1",
      status: "done",
      text: "Transcript",
      storagePathTxt: null,
      createdAt: Timestamp.now(),
    });
    await adminDb.collection("meetings").doc(created.meetingId).collection("minutes").doc("rec-1").set({
      recordingId: "rec-1",
      status: "done",
      minutesMarkdown: "# Acta",
      minutesJson: {
        language: "ca",
        summary: "Resum",
        attendees: [],
        agenda: [],
        decisions: [],
        tasks: [],
      },
      createdAt: Timestamp.now(),
    });
    await adminDb.collection("meeting_ingest_jobs").doc(buildId("job")).set({
      meetingId: created.meetingId,
      orgId: "org-test",
      recordingId: "rec-1",
      source: "daily",
      status: "completed",
      recordingUrl: "https://example.com/final.mp4",
      error: null,
      createdAt: 300,
      updatedAt: 300,
    });

    const deleted = await deleteMeetingById(created.meetingId);
    const [meetingSnap, recordingsSnap, transcriptsSnap, minutesSnap, jobsSnap, meetingLookup] =
      await Promise.all([
        adminDb.collection("meetings").doc(created.meetingId).get(),
        adminDb.collection("meetings").doc(created.meetingId).collection("recordings").get(),
        adminDb.collection("meetings").doc(created.meetingId).collection("transcripts").get(),
        adminDb.collection("meetings").doc(created.meetingId).collection("minutes").get(),
        adminDb.collection("meeting_ingest_jobs").where("meetingId", "==", created.meetingId).get(),
        getMeetingById(created.meetingId),
      ]);

    assert.equal(deleted, true);
    assert.equal(meetingSnap.exists, false);
    assert.equal(recordingsSnap.empty, true);
    assert.equal(transcriptsSnap.empty, true);
    assert.equal(minutesSnap.empty, true);
    assert.equal(jobsSnap.empty, true);
    assert.equal(meetingLookup, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getOwnerMeetings returns only past meetings that are not active", async () => {
  const orgId = buildId("org");
  const now = Date.now();

  await adminDb.collection("meetings").doc(buildId("meeting-past-ready")).set({
    orgId,
    title: "Past ready meeting",
    description: null,
    createdAt: now - 1000,
    createdBy: "owner-dashboard",
    meetingUrl: null,
    dailyRoomName: null,
    dailyRoomUrl: null,
    recordingStatus: "ready",
    recordingUrl: null,
    transcript: null,
    minutesDraft: null,
    pollId: null,
    scheduledAt: Timestamp.fromMillis(now - 3_600_000),
  });

  await adminDb.collection("meetings").doc(buildId("meeting-future")).set({
    orgId,
    title: "Future meeting",
    description: null,
    createdAt: now - 900,
    createdBy: "owner-dashboard",
    meetingUrl: null,
    dailyRoomName: null,
    dailyRoomUrl: null,
    recordingStatus: "none",
    recordingUrl: null,
    transcript: null,
    minutesDraft: null,
    pollId: null,
    scheduledAt: Timestamp.fromMillis(now + 3_600_000),
  });

  await adminDb.collection("meetings").doc(buildId("meeting-past-processing")).set({
    orgId,
    title: "Past processing meeting",
    description: null,
    createdAt: now - 800,
    createdBy: "owner-dashboard",
    meetingUrl: null,
    dailyRoomName: null,
    dailyRoomUrl: null,
    recordingStatus: "processing",
    recordingUrl: null,
    transcript: null,
    minutesDraft: null,
    pollId: null,
    scheduledAt: Timestamp.fromMillis(now - 7_200_000),
  });

  const meetings = await getOwnerMeetings(orgId);

  assert.equal(meetings.length, 1);
  assert.equal(meetings[0]?.title, "Past ready meeting");
  assert.equal(canDeletePastMeeting(meetings[0]!), true);
});

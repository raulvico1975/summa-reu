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
    assert.equal(created.provisioningStatus, "usable");
    assert.equal(created.provisioningError, null);
    assert.equal(meeting?.dailyRoomName, created.dailyRoomName);
    assert.equal(meeting?.dailyRoomUrl, created.dailyRoomUrl);
    assert.equal(meeting?.meetingUrl, created.meetingUrl);
    assert.equal(meeting?.provisioningStatus, "usable");
    assert.equal(meeting?.provisioningError, null);
    assert.equal(typeof meeting?.provisioningReadyAt, "number");
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
    assert.equal(created.provisioningStatus, "provisioning_failed");
    assert.equal(created.provisioningError?.code, "Daily create room failed");
    assert.equal(meeting?.dailyRoomName, null);
    assert.equal(meeting?.dailyRoomUrl, null);
    assert.equal(meeting?.meetingUrl, null);
    assert.equal(meeting?.provisioningStatus, "provisioning_failed");
    assert.equal(meeting?.provisioningError?.code, "Daily create room failed");
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
    assert.equal(meeting?.provisioningStatus, "provisioning_failed");
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

test("poll page links meetings only when a usable meeting exists", async () => {
  const source = await fs.readFile("app/polls/[pollId]/page.tsx", "utf8");

  assert.equal(source.includes("getUsableMeetingIdByPollId"), true);
  assert.equal(source.includes("const canClosePoll = effectivePollStatus === \"open\" || effectivePollStatus === \"close_failed\";"), true);
});

test("owner meeting page rejects meetings that are not usable", async () => {
  const source = await fs.readFile("app/owner/meetings/[meetingId]/page.tsx", "utf8");

  assert.equal(source.includes("!meeting || meeting.orgId !== owner.orgId || !isMeetingUsable(meeting)"), true);
});

test("owner meeting page only exposes final artifacts when recordingStatus is ready", async () => {
  const source = await fs.readFile("app/owner/meetings/[meetingId]/page.tsx", "utf8");

  assert.equal(source.includes("const canShowFinalArtifacts = recordingStatus === \"ready\";"), true);
  assert.equal(source.includes("const transcript = canShowFinalArtifacts ?"), true);
  assert.equal(source.includes("const minutesDraft = canShowFinalArtifacts"), true);
  assert.equal(source.includes("{canShowFinalArtifacts ? ("), true);
  assert.equal(source.includes("{canShowFinalArtifacts && minutesDraft ? ("), true);
  assert.equal(source.includes("i18n.meeting.transcriptReadyOnly"), true);
  assert.equal(source.includes("i18n.meeting.minutesReadyOnly"), true);
});

test("owner meeting page keeps stopping, processing and error states visible without exposing results", async () => {
  const source = await fs.readFile("app/owner/meetings/[meetingId]/page.tsx", "utf8");

  assert.equal(source.includes("const showRefresh = recordingStatus === \"stopping\" || recordingStatus === \"processing\";"), true);
  assert.equal(source.includes("const isAwaitingDailyConfirmation = recordingStatus === \"stopping\";"), true);
  assert.equal(source.includes("const isProcessing = latestIngestJob?.status === \"processing\" || recordingStatus === \"processing\";"), true);
  assert.equal(source.includes("const showProcessingError = recordingStatus === \"error\" || latestIngestJob?.status === \"error\";"), true);
  assert.equal(source.includes("i18n.meeting.transcriptPendingWebhook"), true);
  assert.equal(source.includes("i18n.meeting.transcriptProcessing"), true);
  assert.equal(source.includes("i18n.meeting.processingErrorTitle"), true);
});

test("meeting recording controls only show real actions for none and recording", async () => {
  const source = await fs.readFile("src/components/meetings/meeting-recording-controls.tsx", "utf8");

  assert.equal(source.includes("const showStartRecordingButton = recordingStatus === \"none\";"), true);
  assert.equal(source.includes("const showStopRecordingButton = recordingStatus === \"recording\";"), true);
  assert.equal(source.includes("{showStartRecordingButton || showStopRecordingButton ? ("), true);
  assert.equal(source.includes("{showStartRecordingButton ? ("), true);
  assert.equal(source.includes("{showStopRecordingButton ? ("), true);
  assert.equal(source.includes("recordingStatus === \"stopping\""), true);
  assert.equal(source.includes("recordingStatus === \"processing\""), true);
});

test("meeting control panel and i18n copy reflect processing, ready and error states", async () => {
  const [panelSource, caSource, esSource] = await Promise.all([
    fs.readFile("src/components/meetings/meeting-control-panel.tsx", "utf8"),
    fs.readFile("src/i18n/ca.ts", "utf8"),
    fs.readFile("src/i18n/es.extra.ts", "utf8"),
  ]);

  assert.equal(panelSource.includes("recordingStatus === \"processing\""), true);
  assert.equal(panelSource.includes("i18n.meeting.stepProcessing"), true);
  assert.equal(panelSource.includes("i18n.meeting.stepResultReady"), true);
  assert.equal(panelSource.includes("i18n.meeting.stepResultError"), true);

  assert.equal(caSource.includes("transcriptReadyOnly"), true);
  assert.equal(caSource.includes("minutesReadyOnly"), true);
  assert.equal(caSource.includes("resultsReadyHint"), true);

  assert.equal(esSource.includes("transcriptReadyOnly"), true);
  assert.equal(esSource.includes("minutesReadyOnly"), true);
  assert.equal(esSource.includes("resultsReadyHint"), true);
});

test("daily recording webhook accepts the real payload shape that sends type", async () => {
  const source = await fs.readFile("app/api/webhooks/daily/recording-complete/route.ts", "utf8");

  assert.equal(source.includes("type?: string;"), true);
  assert.equal(source.includes("body.event ?? body.type ?? body.payload?.event ?? body.payload?.type ?? \"\""), true);
  assert.equal(source.includes("event === \"recording.ready-to-download\""), true);
  assert.equal(source.includes("event === \"recording.completed\""), true);
});

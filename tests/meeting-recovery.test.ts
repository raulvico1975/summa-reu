import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import test from "node:test";
import { Timestamp } from "firebase-admin/firestore";

process.env.FIREBASE_PROJECT_ID ||= "summa-board";
process.env.FIREBASE_STORAGE_BUCKET ||= "summa-board.firebasestorage.app";
process.env.DAILY_API_KEY ||= "test-daily-key";
process.env.DAILY_DOMAIN ||= "summareu";
process.env.MEETING_INGEST_MOCK_MODE ||= "true";

const { adminDb } = await import("../src/lib/firebase/admin.ts");
const {
  closePollCreateMeeting,
  createMeetingForOrg,
  enqueueMeetingIngestJob,
  getMeetingById,
  startMeetingIngestRetry,
  updateMeetingIngestJobStatus,
} = await import("../src/lib/db/repo.ts");
const { processMeetingIngestJob } = await import("../src/lib/jobs/processMeetingIngestJob.ts");

function buildId(prefix: string) {
  return `${prefix}-${crypto.randomBytes(6).toString("hex")}`;
}

async function seedOpenPoll() {
  const pollId = buildId("poll");
  const optionId = buildId("option");

  await adminDb.collection("polls").doc(pollId).set({
    orgId: "org-recovery",
    title: `Poll ${pollId}`,
    description: "Poll for recovery tests",
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

async function seedMeetingWithFailedIngest(input: {
  recordingStatus: "error" | "processing";
  processingDeadlineAt?: number | null;
}) {
  const meetingId = await createMeetingForOrg({
    orgId: "org-recovery",
    title: `Meeting ${buildId("title")}`,
    description: "meeting for retry ingest",
    createdBy: "owner-recovery",
  });

  const recordingId = buildId("recording");
  const recordingUrl = `https://example.com/${recordingId}.mp4`;

  await adminDb.collection("meetings").doc(meetingId).set(
    {
      meetingUrl: `https://summareu.daily.co/${meetingId}`,
      dailyRoomUrl: `https://summareu.daily.co/${meetingId}`,
      dailyRoomName: meetingId,
      provisioningStatus: "usable",
      recordingStatus: input.recordingStatus,
      recordingUrl,
      processingDeadlineAt: input.processingDeadlineAt ?? null,
      recoveryState: "retry_pending",
      recoveryReason: "seeded-test-error",
    },
    { merge: true }
  );

  const enqueued = await enqueueMeetingIngestJob({
    meetingId,
    orgId: "org-recovery",
    recordingId,
    recordingUrl,
  });

  await updateMeetingIngestJobStatus({
    jobId: enqueued.jobId,
    status: input.recordingStatus === "error" ? "error" : "processing",
    error: input.recordingStatus === "error" ? "SEEDED_ERROR" : null,
  });

  return { meetingId, recordingId, recordingUrl, jobId: enqueued.jobId };
}

test("retry room creation turns provisioning_failed into usable on the same meeting", async () => {
  const { pollId, optionId } = await seedOpenPoll();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => new Response("boom", { status: 500 });
  const failed = await closePollCreateMeeting({
    pollId,
    winningOptionId: optionId,
    createdBy: "owner-recovery-fail",
  });

  globalThis.fetch = async (_input, init) => {
    const payload = JSON.parse(String(init?.body ?? "{}"));
    return new Response(
      JSON.stringify({
        name: payload.name,
        url: `https://summareu.daily.co/${payload.name}`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const retried = await closePollCreateMeeting({
      pollId,
      winningOptionId: optionId,
      createdBy: "owner-recovery-success",
    });
    const meeting = await getMeetingById(retried.meetingId);

    assert.equal(retried.meetingId, failed.meetingId);
    assert.equal(retried.provisioningStatus, "usable");
    assert.equal(meeting?.provisioningStatus, "usable");
    assert.equal(meeting?.recoveryState, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retry room creation keeps provisioning_failed when Daily still fails", async () => {
  const { pollId, optionId } = await seedOpenPoll();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => new Response("boom", { status: 500 });

  try {
    const failed = await closePollCreateMeeting({
      pollId,
      winningOptionId: optionId,
      createdBy: "owner-recovery-first-fail",
    });
    const retried = await closePollCreateMeeting({
      pollId,
      winningOptionId: optionId,
      createdBy: "owner-recovery-second-fail",
    });
    const meeting = await getMeetingById(retried.meetingId);

    assert.equal(retried.meetingId, failed.meetingId);
    assert.equal(retried.provisioningStatus, "provisioning_failed");
    assert.equal(meeting?.provisioningStatus, "provisioning_failed");
    assert.equal(meeting?.recoveryState, "retry_failed");
    assert.equal(meeting?.recoveryReason, "retry_room_creation");
    assert.equal(typeof meeting?.lastRecoveryAttemptAt, "number");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retry room creation keeps the previously chosen winning option in the retry UI", async () => {
  const [pollSource, formSource] = await Promise.all([
    fs.readFile("app/polls/[pollId]/page.tsx", "utf8"),
    fs.readFile("src/components/polls/close-poll-form.tsx", "utf8"),
  ]);

  assert.equal(
    pollSource.includes('initialWinningOptionId={poll.winningOptionId ?? options[0]?.id ?? ""}'),
    true
  );
  assert.equal(
    pollSource.includes("lockOptionSelection={showRetryRoomCreation && !!poll.winningOptionId}"),
    true
  );
  assert.equal(
    formSource.includes("useState(initialWinningOptionId ?? options[0]?.id ?? \"\")"),
    true
  );
  assert.equal(formSource.includes("disabled={lockOptionSelection}"), true);
});

test("retry ingest over error moves the meeting back to processing and can reach ready", async () => {
  const seeded = await seedMeetingWithFailedIngest({ recordingStatus: "error" });
  const retry = await startMeetingIngestRetry({ meetingId: seeded.meetingId });

  assert.equal(retry.ok, true);
  if (!retry.ok) {
    return;
  }

  const afterRetry = await getMeetingById(seeded.meetingId);
  assert.equal(afterRetry?.recordingStatus, "processing");
  assert.equal(afterRetry?.recoveryState, "retry_running");
  assert.equal(typeof afterRetry?.processingDeadlineAt, "number");

  const duplicateRetry = await startMeetingIngestRetry({ meetingId: seeded.meetingId });
  assert.deepEqual(duplicateRetry, { ok: false, reason: "not_retryable" });

  await processMeetingIngestJob({
    meetingId: seeded.meetingId,
    recordingId: retry.recordingId,
    recordingUrl: retry.recordingUrl,
  });
  await updateMeetingIngestJobStatus({
    jobId: retry.jobId,
    status: "completed",
    error: null,
  });

  const completed = await getMeetingById(seeded.meetingId);
  assert.equal(completed?.recordingStatus, "ready");
  assert.equal(completed?.recoveryState, null);
  assert.equal(typeof completed?.transcript, "string");
  assert.equal(typeof completed?.minutesDraft, "string");
});

test("retry ingest only unlocks processing meetings after the deadline expires", async () => {
  const blocked = await seedMeetingWithFailedIngest({
    recordingStatus: "processing",
    processingDeadlineAt: Date.now() + 60_000,
  });

  assert.deepEqual(await startMeetingIngestRetry({ meetingId: blocked.meetingId }), {
    ok: false,
    reason: "not_retryable",
  });

  await adminDb.collection("meetings").doc(blocked.meetingId).set(
    {
      processingDeadlineAt: Date.now() - 1_000,
    },
    { merge: true }
  );

  const retried = await startMeetingIngestRetry({ meetingId: blocked.meetingId });
  assert.equal(retried.ok, true);
});

test("duplicate webhook keeps the current error state until a new ingest job is accepted", async () => {
  const source = await fs.readFile("app/api/webhooks/daily/recording-complete/route.ts", "utf8");

  const enqueueIndex = source.indexOf("const enqueued = await enqueueMeetingIngestJob");
  const duplicateReturnIndex = source.indexOf("return NextResponse.json({ ok: true, duplicate: true });");
  const processingUpdateIndex = source.indexOf("await updateMeetingRecordingState({");

  assert.equal(enqueueIndex >= 0, true);
  assert.equal(duplicateReturnIndex >= 0, true);
  assert.equal(processingUpdateIndex >= 0, true);
  assert.equal(enqueueIndex < duplicateReturnIndex, true);
  assert.equal(duplicateReturnIndex < processingUpdateIndex, true);
  assert.equal(source.includes("recoveryState: null"), true);
});

test("phase 3A surfaces retry room creation and retry ingest only where they belong", async () => {
  const [pollSource, meetingPageSource, panelSource, routeSource] = await Promise.all([
    fs.readFile("app/polls/[pollId]/page.tsx", "utf8"),
    fs.readFile("app/owner/meetings/[meetingId]/page.tsx", "utf8"),
    fs.readFile("src/components/meetings/meeting-control-panel.tsx", "utf8"),
    fs.readFile("app/api/owner/meetings/retry-ingest/route.ts", "utf8"),
  ]);

  assert.equal(pollSource.includes("const showRetryRoomCreation = effectivePollStatus === \"close_failed\" && !usableMeetingId;"), true);
  assert.equal(pollSource.includes("i18n.poll.retryRoomCreation"), true);
  assert.equal(meetingPageSource.includes("const canRetryIngest ="), true);
  assert.equal(meetingPageSource.includes("isMeetingProcessingExpired(meeting)"), true);
  assert.equal(panelSource.includes("canRetryIngest ? ("), true);
  assert.equal(panelSource.includes("/api/owner/meetings/retry-ingest"), true);
  assert.equal(routeSource.includes("startMeetingIngestRetry"), true);
});

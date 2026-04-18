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

test("daily room creation requests audio-only recordings", async () => {
  const title = buildTitle();
  const originalFetch = globalThis.fetch;
  let receivedEnableRecording: string | null = null;

  globalThis.fetch = async (_input, init) => {
    const payload = JSON.parse(String(init?.body ?? "{}"));
    receivedEnableRecording = payload.properties?.enable_recording ?? null;

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
    await createMeetingWithDaily({
      createMeeting: () =>
        createMeetingForOrg({
          orgId: "org-audio-only",
          title,
          description: "audio-only room creation",
          createdBy: "owner-audio-only",
        }),
    });

    assert.equal(receivedEnableRecording, "cloud-audio-only");
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

test("manage poll page keeps admin actions separate from the public vote matrix", async () => {
  const source = await fs.readFile("app/polls/[pollId]/page.tsx", "utf8");

  assert.equal(source.includes("ResultsTable"), false);
  assert.equal(source.includes("DeleteVoteButton"), true);
  assert.equal(source.includes("voteManagementTitle"), true);
  assert.equal(source.includes("i18n.poll.openPublicResults"), true);
  assert.equal(source.includes("ClosePollForm"), true);
});

test("public results page renders the detailed vote matrix", async () => {
  const source = await fs.readFile("app/p/[slug]/results/page.tsx", "utf8");

  assert.equal(source.includes("ResultsTable"), true);
  assert.equal(source.includes("i18n.poll.votesTable"), true);
});

test("owner vote delete route exists and validates the poll ownership", async () => {
  const source = await fs.readFile("app/api/owner/polls/votes/delete/route.ts", "utf8");

  assert.equal(source.includes("deleteVoteByVoterId"), true);
  assert.equal(source.includes("i18n.errors.voteNotFound"), true);
  assert.equal(source.includes("requireActiveSubscription"), true);
});

test("production CSP allows Next inline bootstrap scripts", async () => {
  const source = await fs.readFile("next.config.ts", "utf8");

  assert.equal(source.includes("script-src 'self' 'unsafe-inline'"), true);
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
  assert.equal(source.includes("import { MeetingReadySummary } from \"@/src/components/meetings/meeting-ready-summary\";"), true);
  assert.equal(source.includes("<MeetingReadySummary"), true);
  assert.equal(source.includes(") : (\n        <Card className=\"border-slate-300 shadow-sm\">"), true);
  assert.equal(source.includes("id=\"transcript-section\""), true);
  assert.equal(source.includes("id=\"minutes-editor\""), true);
  assert.equal(source.includes("<MinutesEditor meetingId={meeting.id} minutesId={minutesId} initialMarkdown={minutesDraft} />"), true);
  assert.equal(source.includes("<MeetingResultsPreview recordingStatus={recordingStatus} />"), true);
});

test("close poll redirects to meeting with a prepared invite state", async () => {
  const source = await fs.readFile("src/components/polls/close-poll-form.tsx", "utf8");

  assert.equal(source.includes("/owner/meetings/${data.meetingId}?created=1"), true);
});

test("owner meeting page can render a prepared invite pack after close poll", async () => {
  const source = await fs.readFile("app/owner/meetings/[meetingId]/page.tsx", "utf8");

  assert.equal(source.includes("const highlightInvitePack = created === \"1\";"), true);
  assert.equal(source.includes("const showInvitePack = Boolean(dailyRoomUrl) && recordingStatus !== \"ready\";"), true);
  assert.equal(source.includes("MeetingInviteCard"), true);
  assert.equal(source.includes("inviteShareMessageTemplate"), true);
  assert.equal(source.includes("getPollVoteRows"), true);
});

test("owner meeting page exposes manual recovery and hides delete until it is valid", async () => {
  const source = await fs.readFile("app/owner/meetings/[meetingId]/page.tsx", "utf8");

  assert.equal(source.includes("RecordingUploader"), true);
  assert.equal(
    source.includes("const showManualRecovery = !canShowFinalArtifacts && (!dailyRoomUrl || showProcessingError || isProcessingExpired);"),
    true
  );
  assert.equal(source.includes("<Card id=\"manual-recovery\" className=\"border-amber-200 shadow-sm\">"), true);
  assert.equal(source.includes("const canShowDeleteSection = canDeletePastMeeting(meeting);"), true);
  assert.equal(source.includes("{canShowDeleteSection ? ("), true);
});

test("owner meeting page keeps processing states visible and swaps empty results for a premium preview", async () => {
  const [pageSource, previewSource] = await Promise.all([
    fs.readFile("app/owner/meetings/[meetingId]/page.tsx", "utf8"),
    fs.readFile("src/components/meetings/meeting-results-preview.tsx", "utf8"),
  ]);

  assert.equal(pageSource.includes("const showRefresh = recordingStatus === \"stopping\" || recordingStatus === \"processing\";"), true);
  assert.equal(pageSource.includes("const showProcessingError = recordingStatus === \"error\" || latestIngestJob?.status === \"error\";"), true);
  assert.equal(pageSource.includes("import { MeetingResultsPreview } from \"@/src/components/meetings/meeting-results-preview\";"), true);
  assert.equal(pageSource.includes("{canShowFinalArtifacts ? ("), true);
  assert.equal(pageSource.includes("<MeetingResultsPreview recordingStatus={recordingStatus} />"), true);
  assert.equal(previewSource.includes("resultsPreviewProcessingTitle"), true);
  assert.equal(previewSource.includes("resultsPreviewNeedsHelpTitle"), true);
  assert.equal(previewSource.includes("resultsPreviewTranscriptTitle"), true);
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
  assert.equal(panelSource.includes("showMeetingLinkCard = true"), true);
  assert.equal(panelSource.includes("recordingStateReadyToStartTitle"), true);
  assert.equal(panelSource.includes("roomStateReadyTitle"), true);
  assert.equal(panelSource.includes("getStepClasses"), true);
  assert.equal(panelSource.includes("JourneyStepState"), true);
  assert.equal(panelSource.includes("stepManualRecovery"), true);
  assert.equal(panelSource.includes("roomStateManualReadyTitle"), true);
  assert.equal(panelSource.includes("showManualNoRoomHint"), true);
  assert.equal(panelSource.includes("noMeetingRoomNeededTitle"), true);

  assert.equal(caSource.includes("transcriptReadyOnly"), true);
  assert.equal(caSource.includes("minutesReadyOnly"), true);
  assert.equal(caSource.includes("resultsReadyHint"), true);
  assert.equal(caSource.includes("inviteReadyTitle"), true);
  assert.equal(caSource.includes("copyInviteMessage"), true);
  assert.equal(caSource.includes("manualRecoveryTitle"), true);
  assert.equal(caSource.includes("actionNowLabel"), true);
  assert.equal(caSource.includes("recordingStateProcessingTitle"), true);
  assert.equal(caSource.includes("resultsPreviewTitle"), true);
  assert.equal(caSource.includes("stepOpenMeeting: \"Obre la sala\""), true);
  assert.equal(caSource.includes("goToManualRecovery"), true);
  assert.equal(caSource.includes("roomStateManualFlowTitle"), true);
  assert.equal(caSource.includes("stepManualNoRoom"), true);
  assert.equal(caSource.includes("contextManualFlow"), true);

  assert.equal(esSource.includes("transcriptReadyOnly"), true);
  assert.equal(esSource.includes("minutesReadyOnly"), true);
  assert.equal(esSource.includes("resultsReadyHint"), true);
  assert.equal(esSource.includes("inviteReadyTitle"), true);
  assert.equal(esSource.includes("copyInviteMessage"), true);
  assert.equal(esSource.includes("manualRecoveryTitle"), true);
  assert.equal(esSource.includes("actionNowLabel"), true);
  assert.equal(esSource.includes("recordingStateProcessingTitle"), true);
  assert.equal(esSource.includes("resultsPreviewTitle"), true);
  assert.equal(esSource.includes("stepOpenMeeting: \"Abre la sala\""), true);
  assert.equal(esSource.includes("goToManualRecovery"), true);
  assert.equal(esSource.includes("roomStateManualFlowTitle"), true);
  assert.equal(esSource.includes("stepManualNoRoom"), true);
  assert.equal(esSource.includes("contextManualFlow"), true);
});

test("manual recording processing promotes the meeting through the same ready and error states", async () => {
  const [routeSource, taskSource, controlsSource] = await Promise.all([
    fs.readFile("app/api/owner/process-recording/route.ts", "utf8"),
    fs.readFile("src/lib/meetings/process-recording-task.ts", "utf8"),
    fs.readFile("src/components/meetings/meeting-recording-controls.tsx", "utf8"),
  ]);

  assert.equal(routeSource.includes("buildMeetingProcessingDeadline"), true);
  assert.equal(routeSource.includes("updateMeetingRecordingState"), true);
  assert.equal(routeSource.includes("updateMeetingArtifacts"), true);
  assert.equal(routeSource.includes("recordingStatus: \"processing\""), true);
  assert.equal(routeSource.includes("recordingStatus: \"ready\""), true);
  assert.equal(routeSource.includes("recordingStatus: \"error\""), true);
  assert.equal(taskSource.includes("transcriptText: string;"), true);
  assert.equal(taskSource.includes("minutesMarkdown: string;"), true);
  assert.equal(controlsSource.includes("href=\"#manual-recovery\""), true);
});

test("ready meetings show a summary card with copy, export and review actions", async () => {
  const [pageSource, summarySource, caSource, esSource] = await Promise.all([
    fs.readFile("app/owner/meetings/[meetingId]/page.tsx", "utf8"),
    fs.readFile("src/components/meetings/meeting-ready-summary.tsx", "utf8"),
    fs.readFile("src/i18n/ca.ts", "utf8"),
    fs.readFile("src/i18n/es.extra.ts", "utf8"),
  ]);

  assert.equal(pageSource.includes("MeetingReadySummary"), true);
  assert.equal(summarySource.includes("copyMinutes"), true);
  assert.equal(summarySource.includes("href=\"#minutes-editor\""), true);
  assert.equal(summarySource.includes("href=\"#transcript-section\""), true);
  assert.equal(summarySource.includes("exportMinutesMd"), true);
  assert.equal(summarySource.includes("resultsHref"), true);
  assert.equal(caSource.includes("readySummaryTitle"), true);
  assert.equal(caSource.includes("copyMinutes"), true);
  assert.equal(caSource.includes("openPublicResults"), true);
  assert.equal(caSource.includes("Transcripció literal disponible"), true);
  assert.equal(caSource.includes("Proposta d'acta editable"), true);
  assert.equal(esSource.includes("readySummaryTitle"), true);
  assert.equal(esSource.includes("copyMinutes"), true);
  assert.equal(esSource.includes("openPublicResults"), true);
});

test("minutes editor defaults to document review mode and only edits on demand", async () => {
  const [editorSource, caSource, esSource] = await Promise.all([
    fs.readFile("src/components/meetings/minutes-editor.tsx", "utf8"),
    fs.readFile("src/i18n/ca.ts", "utf8"),
    fs.readFile("src/i18n/es.extra.ts", "utf8"),
  ]);

  assert.equal(editorSource.includes("function parseMarkdownBlocks"), true);
  assert.equal(editorSource.includes("function MinutesDocumentPreview"), true);
  assert.equal(editorSource.includes("const [isEditing, setIsEditing] = useState(false);"), true);
  assert.equal(editorSource.includes("{isEditing ? ("), true);
  assert.equal(editorSource.includes("i18n.meeting.editMinutes"), true);
  assert.equal(editorSource.includes("i18n.meeting.cancelMinutesEditing"), true);
  assert.equal(editorSource.includes("i18n.meeting.compareWithTranscript"), true);
  assert.equal(editorSource.includes("i18n.meeting.minutesEditorUnsavedChanges"), true);
  assert.equal(caSource.includes("minutesEditorReviewBody"), true);
  assert.equal(caSource.includes("editMinutes"), true);
  assert.equal(caSource.includes("compareWithTranscript"), true);
  assert.equal(esSource.includes("minutesEditorReviewBody"), true);
  assert.equal(esSource.includes("editMinutes"), true);
  assert.equal(esSource.includes("compareWithTranscript"), true);
});

test("ready transcript uses a guided viewer with copy and expand actions", async () => {
  const [pageSource, viewerSource, caSource, esSource] = await Promise.all([
    fs.readFile("app/owner/meetings/[meetingId]/page.tsx", "utf8"),
    fs.readFile("src/components/meetings/meeting-transcript-viewer.tsx", "utf8"),
    fs.readFile("src/i18n/ca.ts", "utf8"),
    fs.readFile("src/i18n/es.extra.ts", "utf8"),
  ]);

  assert.equal(pageSource.includes("import { MeetingTranscriptViewer } from \"@/src/components/meetings/meeting-transcript-viewer\";"), true);
  assert.equal(pageSource.includes("<MeetingTranscriptViewer transcript={transcript} />"), true);
  assert.equal(viewerSource.includes("function buildTranscriptChunks"), true);
  assert.equal(viewerSource.includes("const [expanded, setExpanded] = useState(true);"), true);
  assert.equal(viewerSource.includes("i18n.meeting.copyTranscript"), true);
  assert.equal(viewerSource.includes("i18n.meeting.expandTranscript"), true);
  assert.equal(viewerSource.includes("i18n.meeting.transcriptChunkLabel"), true);
  assert.equal(caSource.includes("transcriptViewerEyebrow"), true);
  assert.equal(caSource.includes("copyTranscript"), true);
  assert.equal(caSource.includes("Transcripció literal"), true);
  assert.equal(esSource.includes("transcriptViewerEyebrow"), true);
  assert.equal(esSource.includes("copyTranscript"), true);
});

test("daily recording webhook accepts the real payload shape that sends type", async () => {
  const source = await fs.readFile("app/api/webhooks/daily/recording-complete/route.ts", "utf8");

  assert.equal(source.includes("type?: string;"), true);
  assert.equal(source.includes("body.event ?? body.type ?? body.payload?.event ?? body.payload?.type ?? \"\""), true);
  assert.equal(source.includes("event === \"recording.ready-to-download\""), true);
  assert.equal(source.includes("event === \"recording.completed\""), true);
  assert.equal(source.includes("signatureHeader: request.headers.get(\"x-webhook-signature\")"), true);
});

test("daily helpers keep webhook auth compatible with HMAC and audio-only recordings", async () => {
  const source = await fs.readFile("src/lib/meetings/daily.ts", "utf8");

  assert.equal(source.includes('const DAILY_AUDIO_RECORDING_TYPE = "cloud-audio-only";'), true);
  assert.equal(source.includes("buildDailyWebhookSignature"), true);
  assert.equal(source.includes('retryType: "exponential"'), true);
});

test("password login route can target the auth emulator in local development", async () => {
  const [routeSource, packageSource] = await Promise.all([
    fs.readFile("app/api/auth/password-login/route.ts", "utf8"),
    fs.readFile("package.json", "utf8"),
  ]);

  assert.equal(routeSource.includes("FIREBASE_AUTH_EMULATOR_HOST"), true);
  assert.equal(routeSource.includes("http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1"), true);
  assert.equal(packageSource.includes("FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099"), true);
});

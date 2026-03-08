import crypto from "node:crypto";
import {
  FieldValue,
  Timestamp,
  type CollectionReference,
  type DocumentReference,
} from "firebase-admin/firestore";
import { adminDb } from "@/src/lib/firebase/admin";
import type {
  MeetingDoc,
  MeetingIngestJobDoc,
  MinutesDoc,
  MinutesJson,
  OrgDoc,
  OrgSubscriptionStatus,
  PollDoc,
  PollOptionDoc,
  PollVoteDoc,
  PollVoterDoc,
  RecordingDoc,
  StripeEventDoc,
  TranscriptDoc,
} from "@/src/lib/db/types";
import { defaultTimezone } from "@/src/lib/firebase/env";

export type PollOption = PollOptionDoc & { id: string };

export type PollWithOptions = PollDoc & {
  id: string;
  options: PollOption[];
};

export type VoteMatrixRow = {
  voterId: string;
  voterName: string;
  availabilityByOptionId: Record<string, boolean>;
};

export type MeetingWithAssets = MeetingDoc & {
  id: string;
  poll: (PollDoc & { id: string }) | null;
  recordings: Array<RecordingDoc & { id: string }>;
  transcripts: Array<TranscriptDoc & { id: string }>;
  minutes: Array<MinutesDoc & { id: string }>;
  latestIngestJob: (MeetingIngestJobDoc & { id: string }) | null;
};

const orgsCol = adminDb.collection("orgs") as CollectionReference<OrgDoc>;
const stripeEventsCol = adminDb.collection("stripe_events") as CollectionReference<StripeEventDoc>;
const pollsCol = adminDb.collection("polls") as CollectionReference<PollDoc>;
const meetingsCol = adminDb.collection("meetings") as CollectionReference<MeetingDoc>;
const meetingIngestJobsCol = adminDb.collection(
  "meeting_ingest_jobs"
) as CollectionReference<MeetingIngestJobDoc>;

function buildMeetingIngestJobId(meetingId: string, recordingId: string): string {
  return `${meetingId}__${recordingId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function slugifyTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50);
}

async function ensureUniqueSlug(baseTitle: string): Promise<string> {
  const base = slugifyTitle(baseTitle) || "votacio";
  const existing = await pollsCol.where("slug", "==", base).limit(1).get();
  if (existing.empty) return base;

  for (let i = 0; i < 8; i += 1) {
    const candidate = `${base}-${crypto.randomBytes(2).toString("hex")}`;
    const snap = await pollsCol.where("slug", "==", candidate).limit(1).get();
    if (snap.empty) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}

export async function getOwnerOrgByUid(uid: string): Promise<(OrgDoc & { id: string }) | null> {
  const canonicalDoc = await orgsCol.doc(uid).get();
  if (canonicalDoc.exists) {
    return { id: canonicalDoc.id, ...(canonicalDoc.data() as OrgDoc) };
  }

  const legacySnap = await orgsCol.where("ownerUid", "==", uid).limit(1).get();
  const legacyDoc = legacySnap.docs[0];
  if (!legacyDoc) return null;
  return { id: legacyDoc.id, ...legacyDoc.data() };
}

export async function getOrgById(orgId: string): Promise<(OrgDoc & { id: string }) | null> {
  const doc = await orgsCol.doc(orgId).get();
  if (!doc.exists) {
    return null;
  }

  return { id: doc.id, ...(doc.data() as OrgDoc) };
}

export async function findOrgByStripeCustomerId(
  stripeCustomerId: string
): Promise<(OrgDoc & { id: string }) | null> {
  const snap = await orgsCol.where("stripeCustomerId", "==", stripeCustomerId).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) {
    return null;
  }

  return { id: doc.id, ...(doc.data() as OrgDoc) };
}

export async function findOrgByStripeSubscriptionId(
  stripeSubscriptionId: string
): Promise<(OrgDoc & { id: string }) | null> {
  const snap = await orgsCol.where("stripeSubscriptionId", "==", stripeSubscriptionId).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) {
    return null;
  }

  return { id: doc.id, ...(doc.data() as OrgDoc) };
}

export async function listPollsByOrg(orgId: string): Promise<Array<PollDoc & { id: string }>> {
  const snap = await pollsCol.where("orgId", "==", orgId).orderBy("createdAt", "desc").get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function createPollForOrg(input: {
  orgId: string;
  title: string;
  description: string;
  timezone?: string;
  optionsIso: string[];
}): Promise<{ pollId: string; slug: string }> {
  const slug = await ensureUniqueSlug(input.title);
  const pollRef = pollsCol.doc() as DocumentReference<PollDoc>;

  await pollRef.set({
    orgId: input.orgId,
    title: input.title,
    description: input.description,
    timezone: input.timezone ?? defaultTimezone,
    slug,
    status: "open",
    winningOptionId: null,
    createdAt: FieldValue.serverTimestamp() as Timestamp,
    closedAt: null,
  });

  const optionsCol = pollRef.collection("options") as CollectionReference<PollOptionDoc>;
  const batch = adminDb.batch();
  input.optionsIso.forEach((iso) => {
    const startsAt = new Date(iso);
    if (Number.isNaN(startsAt.getTime())) {
      return;
    }

    const optionRef = optionsCol.doc();
    batch.set(optionRef, {
      startsAt: Timestamp.fromDate(startsAt),
    });
  });

  await batch.commit();
  return { pollId: pollRef.id, slug };
}

export async function getPollBySlug(slug: string): Promise<PollWithOptions | null> {
  const pollSnap = await pollsCol.where("slug", "==", slug).limit(1).get();
  const pollDoc = pollSnap.docs[0];
  if (!pollDoc) return null;

  const optionsSnap = await pollDoc.ref
    .collection("options")
    .orderBy("startsAt", "asc")
    .get();

  return {
    id: pollDoc.id,
    ...pollDoc.data(),
    options: optionsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as PollOptionDoc) })),
  };
}

export async function getPollById(pollId: string): Promise<PollWithOptions | null> {
  const pollDoc = await pollsCol.doc(pollId).get();
  if (!pollDoc.exists) return null;

  const optionsSnap = await pollDoc.ref
    .collection("options")
    .orderBy("startsAt", "asc")
    .get();

  return {
    id: pollDoc.id,
    ...(pollDoc.data() as PollDoc),
    options: optionsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as PollOptionDoc) })),
  };
}

export async function getPollVoteRows(
  pollId: string,
  unknownParticipantLabel = "Participant"
): Promise<VoteMatrixRow[]> {
  const votersSnap = await pollsCol.doc(pollId).collection("voters").get();
  const votesSnap = await pollsCol.doc(pollId).collection("votes").get();

  const voterMap = new Map<string, PollVoterDoc>();
  votersSnap.docs.forEach((doc) => voterMap.set(doc.id, doc.data() as PollVoterDoc));

  return votesSnap.docs.map((doc) => {
    const vote = doc.data() as PollVoteDoc;
    const voter = voterMap.get(doc.id);
    return {
      voterId: doc.id,
      voterName: voter?.name ?? unknownParticipantLabel,
      availabilityByOptionId: vote.availabilityByOptionId ?? {},
    };
  });
}

export async function upsertVoteByVoterId(input: {
  pollId: string;
  voterId: string;
  voterName: string;
  tokenHash: string;
  availabilityByOptionId: Record<string, boolean>;
}): Promise<void> {
  const pollRef = pollsCol.doc(input.pollId);
  const voterRef = pollRef.collection("voters").doc(input.voterId) as DocumentReference<PollVoterDoc>;
  const voteRef = pollRef.collection("votes").doc(input.voterId) as DocumentReference<PollVoteDoc>;

  await adminDb.runTransaction(async (trx) => {
    trx.set(
      voterRef,
      {
        name: input.voterName,
        tokenHash: input.tokenHash,
        createdAt: FieldValue.serverTimestamp() as Timestamp,
        lastSeenAt: FieldValue.serverTimestamp() as Timestamp,
      },
      { merge: true }
    );

    trx.set(voteRef, {
      availabilityByOptionId: input.availabilityByOptionId,
      updatedAt: FieldValue.serverTimestamp() as Timestamp,
    });
  });
}

export async function closePollCreateMeeting(input: {
  pollId: string;
  winningOptionId: string;
  createdBy: string;
  meetingUrl: string;
}): Promise<string> {
  const pollRef = pollsCol.doc(input.pollId);
  const optionRef = pollRef.collection("options").doc(input.winningOptionId);

  const meetingId = await adminDb.runTransaction(async (trx) => {
    const [pollDoc, optionDoc] = await Promise.all([trx.get(pollRef), trx.get(optionRef)]);

    if (!pollDoc.exists) {
      throw new Error("POLL_NOT_FOUND");
    }

    if (!optionDoc.exists) {
      throw new Error("OPTION_NOT_FOUND");
    }

    const poll = pollDoc.data() as PollDoc;
    if (poll.status !== "open") {
      throw new Error("POLL_ALREADY_CLOSED");
    }

    trx.update(pollRef, {
      status: "closed",
      winningOptionId: input.winningOptionId,
      closedAt: FieldValue.serverTimestamp(),
    });

    const meetingRef = meetingsCol.doc();
    const option = optionDoc.data() as PollOptionDoc;

    trx.set(meetingRef, {
      pollId: pollRef.id,
      orgId: poll.orgId,
      title: poll.title,
      description: poll.description,
      createdAt: Date.now(),
      createdBy: input.createdBy,
      meetingUrl: input.meetingUrl,
      recordingStatus: "none",
      recordingUrl: null,
      transcript: null,
      minutesDraft: null,
      scheduledAt: option.startsAt,
    });

    return meetingRef.id;
  });

  return meetingId;
}

export async function createMeetingForOrg(input: {
  orgId: string;
  title: string;
  description?: string;
  createdBy: string;
  meetingUrl: string;
  pollId?: string;
  scheduledAt?: Timestamp | null;
}): Promise<string> {
  const meetingRef = meetingsCol.doc();

  await meetingRef.set({
    orgId: input.orgId,
    title: input.title,
    description: input.description ?? null,
    createdAt: Date.now(),
    createdBy: input.createdBy,
    meetingUrl: input.meetingUrl,
    recordingStatus: "none",
    recordingUrl: null,
    transcript: null,
    minutesDraft: null,
    pollId: input.pollId ?? null,
    scheduledAt: input.scheduledAt ?? null,
  });

  return meetingRef.id;
}

export async function getMeetingById(meetingId: string): Promise<MeetingWithAssets | null> {
  const meetingDoc = await meetingsCol.doc(meetingId).get();
  if (!meetingDoc.exists) return null;

  const meetingData = meetingDoc.data() as MeetingDoc;
  const pollDoc = meetingData.pollId ? await pollsCol.doc(meetingData.pollId).get() : null;

  const [recordingsSnap, transcriptsSnap, minutesSnap] = await Promise.all([
    meetingDoc.ref.collection("recordings").orderBy("createdAt", "desc").get(),
    meetingDoc.ref.collection("transcripts").orderBy("createdAt", "desc").get(),
    meetingDoc.ref.collection("minutes").orderBy("createdAt", "desc").get(),
  ]);
  const ingestJobSnap = await meetingIngestJobsCol
    .where("meetingId", "==", meetingId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  const ingestJobDoc = ingestJobSnap.docs[0];

  return {
    id: meetingDoc.id,
    ...meetingData,
    poll: pollDoc?.exists ? { id: pollDoc.id, ...(pollDoc.data() as PollDoc) } : null,
    recordings: recordingsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as RecordingDoc) })),
    transcripts: transcriptsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as TranscriptDoc) })),
    minutes: minutesSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as MinutesDoc) })),
    latestIngestJob: ingestJobDoc ? { id: ingestJobDoc.id, ...(ingestJobDoc.data() as MeetingIngestJobDoc) } : null,
  };
}

export async function getMeetingIdByPollId(pollId: string): Promise<string | null> {
  const snap = await meetingsCol.where("pollId", "==", pollId).limit(1).get();
  const doc = snap.docs[0];
  return doc ? doc.id : null;
}

export async function getMeetingByMeetingUrl(meetingUrl: string): Promise<MeetingWithAssets | null> {
  const snap = await meetingsCol.where("meetingUrl", "==", meetingUrl).limit(1).get();
  const doc = snap.docs[0];
  return doc ? getMeetingById(doc.id) : null;
}

export async function registerMeetingRecording(input: {
  meetingId: string;
  storagePath: string;
  rawText?: string;
  mimeType?: string;
  originalName?: string;
}): Promise<string> {
  const recordingRef = meetingsCol
    .doc(input.meetingId)
    .collection("recordings")
    .doc() as DocumentReference<RecordingDoc>;

  await recordingRef.set({
    storagePath: input.storagePath,
    rawText: input.rawText ?? null,
    mimeType: input.mimeType ?? null,
    originalName: input.originalName ?? null,
    status: "uploaded",
    createdAt: FieldValue.serverTimestamp() as Timestamp,
    error: null,
  });

  return recordingRef.id;
}

export async function updateRecordingStatus(input: {
  meetingId: string;
  recordingId: string;
  status: RecordingDoc["status"];
  error?: string | null;
}): Promise<void> {
  await meetingsCol
    .doc(input.meetingId)
    .collection("recordings")
    .doc(input.recordingId)
    .set(
      {
        status: input.status,
        error: input.error ?? null,
      },
      { merge: true }
    );
}

export async function getRecording(input: {
  meetingId: string;
  recordingId: string;
}): Promise<(RecordingDoc & { id: string }) | null> {
  const snap = await meetingsCol.doc(input.meetingId).collection("recordings").doc(input.recordingId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as RecordingDoc) };
}

export async function claimRecordingForProcessing(input: {
  meetingId: string;
  recordingId: string;
}): Promise<"claimed" | "processing" | "done" | "missing"> {
  const recordingRef = meetingsCol
    .doc(input.meetingId)
    .collection("recordings")
    .doc(input.recordingId) as DocumentReference<RecordingDoc>;

  return adminDb.runTransaction(async (trx) => {
    const snap = await trx.get(recordingRef);
    if (!snap.exists) {
      return "missing";
    }

    const data = snap.data() as RecordingDoc;
    if (data.status === "processing") {
      return "processing";
    }

    if (data.status === "done") {
      return "done";
    }

    trx.set(
      recordingRef,
      {
        status: "processing",
        error: null,
      },
      { merge: true }
    );

    return "claimed";
  });
}

export async function saveTranscript(input: {
  meetingId: string;
  recordingId: string;
  status: TranscriptDoc["status"];
  text: string;
}): Promise<string> {
  const transcriptRef = meetingsCol
    .doc(input.meetingId)
    .collection("transcripts")
    .doc(input.recordingId) as DocumentReference<TranscriptDoc>;

  await transcriptRef.set({
    recordingId: input.recordingId,
    status: input.status,
    text: input.text,
    storagePathTxt: null,
    createdAt: FieldValue.serverTimestamp() as Timestamp,
  });

  return transcriptRef.id;
}

export async function saveMinutes(input: {
  meetingId: string;
  recordingId: string;
  status: MinutesDoc["status"];
  minutesMarkdown: string;
  minutesJson: MinutesJson;
}): Promise<string> {
  const minutesRef = meetingsCol
    .doc(input.meetingId)
    .collection("minutes")
    .doc(input.recordingId) as DocumentReference<MinutesDoc>;

  await minutesRef.set({
    recordingId: input.recordingId,
    status: input.status,
    minutesMarkdown: input.minutesMarkdown,
    minutesJson: input.minutesJson,
    createdAt: FieldValue.serverTimestamp() as Timestamp,
  });

  return minutesRef.id;
}

export async function updateMinutesMarkdown(input: {
  meetingId: string;
  minutesId: string;
  minutesMarkdown: string;
}): Promise<void> {
  const meetingRef = meetingsCol.doc(input.meetingId);
  await Promise.all([
    meetingRef.collection("minutes").doc(input.minutesId).set(
      { minutesMarkdown: input.minutesMarkdown },
      { merge: true }
    ),
    meetingRef.set({ minutesDraft: input.minutesMarkdown }, { merge: true }),
  ]);
}

export async function updateMeetingRecordingState(input: {
  meetingId: string;
  recordingStatus: MeetingDoc["recordingStatus"];
  recordingUrl?: string | null;
  clearArtifacts?: boolean;
}): Promise<void> {
  const payload: Partial<MeetingDoc> = {
    recordingStatus: input.recordingStatus ?? "none",
  };

  if (input.recordingUrl !== undefined) {
    payload.recordingUrl = input.recordingUrl;
  }

  if (input.clearArtifacts) {
    payload.transcript = null;
    payload.minutesDraft = null;
  }

  await meetingsCol.doc(input.meetingId).set(payload, { merge: true });
}

export async function updateMeetingArtifacts(input: {
  meetingId: string;
  transcript: string;
  minutesDraft: string;
  recordingStatus: MeetingDoc["recordingStatus"];
  recordingUrl?: string | null;
}): Promise<void> {
  const payload: Partial<MeetingDoc> = {
    transcript: input.transcript,
    minutesDraft: input.minutesDraft,
    recordingStatus: input.recordingStatus,
  };

  if (input.recordingUrl !== undefined) {
    payload.recordingUrl = input.recordingUrl;
  }

  await meetingsCol.doc(input.meetingId).set(payload, { merge: true });
}

export async function enqueueMeetingIngestJob(input: {
  meetingId: string;
  orgId: string;
  recordingId: string;
  recordingUrl: string;
}): Promise<{ jobId: string; created: boolean }> {
  const jobId = buildMeetingIngestJobId(input.meetingId, input.recordingId);
  const jobRef = meetingIngestJobsCol.doc(jobId) as DocumentReference<MeetingIngestJobDoc>;

  const created = await adminDb.runTransaction(async (trx) => {
    const snap = await trx.get(jobRef);
    if (snap.exists) {
      return false;
    }

    trx.set(jobRef, {
      meetingId: input.meetingId,
      orgId: input.orgId,
      recordingId: input.recordingId,
      source: "daily",
      status: "queued",
      recordingUrl: input.recordingUrl,
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return true;
  });

  return { jobId, created };
}

export async function claimMeetingIngestJob(
  jobId: string
): Promise<"claimed" | "processing" | "completed" | "error" | "missing"> {
  const jobRef = meetingIngestJobsCol.doc(jobId) as DocumentReference<MeetingIngestJobDoc>;

  return adminDb.runTransaction(async (trx) => {
    const snap = await trx.get(jobRef);
    if (!snap.exists) {
      return "missing";
    }

    const job = snap.data() as MeetingIngestJobDoc;
    if (job.status === "processing") {
      return "processing";
    }

    if (job.status === "completed") {
      return "completed";
    }

    if (job.status === "error") {
      return "error";
    }

    trx.set(
      jobRef,
      {
        status: "processing",
        updatedAt: Date.now(),
        error: null,
      },
      { merge: true }
    );

    return "claimed";
  });
}

export async function updateMeetingIngestJobStatus(input: {
  jobId: string;
  status: MeetingIngestJobDoc["status"];
  error?: string | null;
}): Promise<void> {
  await meetingIngestJobsCol.doc(input.jobId).set(
    {
      status: input.status,
      updatedAt: Date.now(),
      error: input.error ?? null,
    },
    { merge: true }
  );
}

export async function createOrgForOwner(input: { ownerUid: string; name: string }): Promise<string> {
  const ref = orgsCol.doc(input.ownerUid);
  await ref.create({
    name: input.name,
    ownerUid: input.ownerUid,
    createdAt: FieldValue.serverTimestamp() as Timestamp,
    subscriptionStatus: "none",
    plan: "basic",
    recordingLimitMinutes: 90,
  });
  return ref.id;
}

export async function updateOrgSubscription(input: {
  orgId: string;
  subscriptionStatus?: OrgSubscriptionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}): Promise<void> {
  const patch: Partial<OrgDoc> = {};

  if (input.subscriptionStatus) {
    patch.subscriptionStatus = input.subscriptionStatus;
  }
  if (input.stripeCustomerId) {
    patch.stripeCustomerId = input.stripeCustomerId;
  }
  if (input.stripeSubscriptionId) {
    patch.stripeSubscriptionId = input.stripeSubscriptionId;
  }

  await orgsCol.doc(input.orgId).set(patch, { merge: true });
}

export async function recordStripeEvent(data: {
  eventId: string;
  type: string;
  created: number;
  orgId?: string | null;
  subscriptionId?: string | null;
  raw?: unknown;
}): Promise<void> {
  const ref = stripeEventsCol.doc(data.eventId);
  await ref.set(
    {
      eventId: data.eventId,
      type: data.type,
      created: data.created,
      orgId: data.orgId ?? null,
      subscriptionId: data.subscriptionId ?? null,
      receivedAt: FieldValue.serverTimestamp() as Timestamp,
      raw: data.raw ?? null,
    },
    { merge: true }
  );
}

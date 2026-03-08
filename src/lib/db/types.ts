import type { Timestamp } from "firebase-admin/firestore";

export type PollStatus = "open" | "closed";
export type RecordingStatus = "uploaded" | "processing" | "done" | "error";
export type TranscriptStatus = "pending" | "processing" | "done" | "error";
export type MinutesTaskStatus = "todo" | "doing" | "done";
// Meeting recording state machine: none -> recording -> processing -> ready | error
export type MeetingRecordingStatus = "none" | "recording" | "processing" | "ready" | "error";
export type MeetingIngestJobStatus = "queued" | "processing" | "completed" | "error";

export type OrgDoc = {
  name: string;
  ownerUid: string;
  createdAt: Timestamp;
};

export type PollDoc = {
  orgId: string;
  title: string;
  description: string;
  timezone: string;
  slug: string;
  status: PollStatus;
  winningOptionId: string | null;
  createdAt: Timestamp;
  closedAt: Timestamp | null;
};

export type PollOptionDoc = {
  startsAt: Timestamp;
};

export type PollVoterDoc = {
  name: string;
  tokenHash: string;
  createdAt: Timestamp;
  lastSeenAt: Timestamp;
};

export type PollVoteDoc = {
  availabilityByOptionId: Record<string, boolean>;
  updatedAt: Timestamp;
};

export type MeetingDoc = {
  orgId: string;
  title: string;
  description?: string | null;
  createdAt: number;
  createdBy: string;
  meetingUrl?: string | null;
  recordingStatus?: MeetingRecordingStatus;
  recordingUrl?: string | null;
  transcript?: string | null;
  minutesDraft?: string | null;
  pollId?: string | null;
  scheduledAt?: Timestamp | null;
};

export type RecordingDoc = {
  storagePath: string;
  rawText: string | null;
  mimeType: string | null;
  originalName: string | null;
  status: RecordingStatus;
  createdAt: Timestamp;
  error: string | null;
};

export type TranscriptDoc = {
  recordingId: string;
  status: TranscriptStatus;
  text: string | null;
  storagePathTxt: string | null;
  createdAt: Timestamp;
};

export type MinutesDecision = {
  id: string;
  text: string;
  owner: string | null;
  dueDate: string | null;
  tags: string[];
};

export type MinutesTask = {
  id: string;
  text: string;
  owner: string | null;
  dueDate: string | null;
  status: MinutesTaskStatus;
};

export type MinutesJson = {
  language: "ca" | "es";
  summary: string;
  attendees: string[];
  agenda: string[];
  decisions: MinutesDecision[];
  tasks: MinutesTask[];
};

export type MinutesDoc = {
  recordingId: string;
  status: TranscriptStatus;
  minutesMarkdown: string;
  minutesJson: MinutesJson;
  createdAt: Timestamp;
};

export type MeetingIngestJobDoc = {
  meetingId: string;
  orgId: string;
  recordingId: string;
  source: "daily";
  status: MeetingIngestJobStatus;
  recordingUrl: string;
  error: string | null;
  createdAt: number;
  updatedAt: number;
};

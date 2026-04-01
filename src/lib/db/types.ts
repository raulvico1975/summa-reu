import type { Timestamp } from "firebase-admin/firestore";

export type PollStatus = "open" | "closing" | "closed" | "close_failed";
export type RecordingStatus = "uploaded" | "processing" | "done" | "error";
export type TranscriptStatus = "pending" | "processing" | "done" | "error";
export type MinutesTaskStatus = "todo" | "doing" | "done";
export type OrgSubscriptionStatus = "none" | "pending" | "active" | "past_due" | "canceled";
export type OrgPlan = "basic";
export type MeetingProvisioningStatus = "provisioning" | "usable" | "provisioning_failed";
// Meeting recording state machine: none -> recording -> stopping -> processing -> ready | error
export type MeetingRecordingStatus = "none" | "recording" | "stopping" | "processing" | "ready" | "error";
export type MeetingRecoveryState = "retry_pending" | "retry_running" | "retry_failed";
export type MeetingIngestJobStatus = "queued" | "processing" | "completed" | "error";

export type OperationErrorDoc = {
  code: string;
  message: string | null;
  at: number;
};

export type OrgLanguage = "ca" | "es";

export type OrgDoc = {
  name: string;
  ownerUid: string;
  language?: OrgLanguage;
  createdAt: Timestamp;
  subscriptionStatus?: OrgSubscriptionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  plan?: OrgPlan;
  recordingLimitMinutes?: number;
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
  closeError?: OperationErrorDoc | null;
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
  dailyRoomName?: string | null;
  dailyRoomUrl?: string | null;
  provisioningStatus?: MeetingProvisioningStatus;
  provisioningError?: OperationErrorDoc | null;
  provisioningAttemptedAt?: number | null;
  provisioningReadyAt?: number | null;
  recordingStatus?: MeetingRecordingStatus;
  recordingUrl?: string | null;
  transcript?: string | null;
  minutesDraft?: string | null;
  lastWebhookAt?: number | null;
  recoveryState?: MeetingRecoveryState | null;
  recoveryReason?: string | null;
  processingDeadlineAt?: number | null;
  lastRecoveryAttemptAt?: number | null;
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
  retryCount?: number;
  lastErrorAt?: number | null;
};

export type StripeEventDoc = {
  eventId: string;
  type: string;
  created: number;
  orgId?: string | null;
  subscriptionId?: string | null;
  receivedAt: Timestamp;
  raw: unknown;
};

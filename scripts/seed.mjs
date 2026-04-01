import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import fs from "node:fs/promises";

const projectId = process.env.FIREBASE_PROJECT_ID || "summa-board";

process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8085";
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= "127.0.0.1:9199";

const app = getApps()[0] || initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
const db = getFirestore(app);
const auth = getAuth(app);

const ownerUid = "owner-demo";
const ownerEmail = "owner@summa.local";
const ownerPassword = "123456";
const orgId = ownerUid;
const openPollId = "demo-poll-id";
const openPollSlug = "demo-poll";
const meetingId = "demo-meeting";

const optionDates = [
  new Date(Date.now() + 24 * 60 * 60 * 1000),
  new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
];

const optionIds = ["opt-1", "opt-2", "opt-3"];

async function ensureOwnerUser() {
  try {
    await auth.getUser(ownerUid);
  } catch {
    await auth.createUser({
      uid: ownerUid,
      email: ownerEmail,
      password: ownerPassword,
    });
  }
}

async function seedFirestore() {
  await db.collection("orgs").doc(orgId).set({
    name: "Fundació Demo",
    ownerUid,
    language: "ca",
    createdAt: FieldValue.serverTimestamp(),
    subscriptionStatus: "active",
    plan: "basic",
    recordingLimitMinutes: 90,
  }, { merge: true });

  await db.collection("polls").doc(openPollId).set({
    orgId,
    title: "Junta mensual",
    description: "Votació demo Summa Reu",
    timezone: "Europe/Madrid",
    slug: openPollSlug,
    status: "open",
    winningOptionId: null,
    createdAt: FieldValue.serverTimestamp(),
    closedAt: null,
  }, { merge: true });

  for (let i = 0; i < optionIds.length; i += 1) {
    await db
      .collection("polls")
      .doc(openPollId)
      .collection("options")
      .doc(optionIds[i])
      .set({ startsAt: Timestamp.fromDate(optionDates[i]) }, { merge: true });
  }

  await db.collection("meetings").doc(meetingId).set({
    pollId: "demo-existing-poll",
    orgId,
    title: "Junta mensual",
    description: "Reunió demo Summa Reu",
    createdAt: Date.now(),
    createdBy: ownerUid,
    meetingUrl: "https://mock.daily.local/demo-meeting",
    recordingStatus: "none",
    recordingUrl: null,
    transcript: null,
    minutesDraft: null,
    scheduledAt: Timestamp.fromDate(optionDates[0]),
  }, { merge: true });

  const output = {
    owner: {
      uid: ownerUid,
      email: ownerEmail,
      password: ownerPassword,
    },
    poll: {
      pollId: openPollId,
      slug: openPollSlug,
      optionIds,
    },
    meeting: {
      meetingId,
    },
  };

  await fs.mkdir("scripts", { recursive: true });
  await fs.writeFile("scripts/.seed-output.json", JSON.stringify(output, null, 2), "utf8");

  console.log("Seed completat");
  console.log(JSON.stringify(output, null, 2));
}

await ensureOwnerUser();
await seedFirestore();

import fs from "node:fs/promises";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const emulatorAuthBase = process.env.SMOKE_AUTH_BASE || "http://127.0.0.1:9099";
const projectId = process.env.FIREBASE_PROJECT_ID || "summa-board";

process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8085";

const adminApp = getApps()[0] || initializeApp({ projectId });
const db = getFirestore(adminApp);

async function readSeed() {
  const raw = await fs.readFile("scripts/.seed-output.json", "utf8");
  return JSON.parse(raw);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function signInEmulator(email, password) {
  const authRes = await fetch(
    `${emulatorAuthBase}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );

  assert(authRes.ok, `Sign-in emulator ha fallat per ${email}`);
  const authData = await authRes.json();
  assert(Boolean(authData.idToken), `Sign-in sense idToken per ${email}`);
  return authData.idToken;
}

async function createSession(idToken) {
  const sessionRes = await fetch(`${baseUrl}/api/auth/session-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  assert(sessionRes.ok, "Session login ha fallat");
  const setCookie = sessionRes.headers.get("set-cookie");
  assert(Boolean(setCookie), "Session login sense cookie");
  return setCookie;
}

async function waitFor(check, message, timeoutMs = 10000, intervalMs = 200) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await check();
    if (value) {
      return value;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(message);
}

const seed = await readSeed();

const pollSlug = seed.poll.slug;
const pollId = seed.poll.pollId;
const optionIds = seed.poll.optionIds;
const meetingId = seed.meeting.meetingId;
const ownerEmail = seed.owner?.email;
const ownerPassword = seed.owner?.password;

const homeRes = await fetch(`${baseUrl}/`);
assert(homeRes.ok, "La pàgina pública / no respon OK");
const homeHtml = await homeRes.text();
assert(homeHtml.includes("Accés entitat"), "A / no es veu el CTA d'accés");
assert(homeHtml.includes("Donar d'alta entitat"), "A / no es veu el CTA d'alta");

const pollRes = await fetch(`${baseUrl}/p/${pollSlug}`);
assert(pollRes.ok, "La pàgina pública de votació no respon OK");

const loginRes = await fetch(`${baseUrl}/login`);
assert(loginRes.ok, "La pàgina /login no respon OK");

const availability = Object.fromEntries(optionIds.map((id, index) => [id, index !== 1]));

const voteRes = await fetch(`${baseUrl}/api/public/vote`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    slug: pollSlug,
    voterName: "Test Smoke",
    availabilityByOptionId: availability,
  }),
});

assert(voteRes.ok, "El primer vot no ha retornat OK");
const voteData = await voteRes.json();
assert(Boolean(voteData.voterToken), "No s'ha retornat voterToken");
assert(Boolean(voteData.voterId), "No s'ha retornat voterId");

const voteResOther = await fetch(`${baseUrl}/api/public/vote`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    slug: pollSlug,
    voterName: "Test Smoke Segon Usuari",
    availabilityByOptionId: Object.fromEntries(optionIds.map((id, index) => [id, index !== 0])),
  }),
});

assert(voteResOther.ok, "El vot del segon usuari no ha retornat OK");
const voteDataOther = await voteResOther.json();
assert(Boolean(voteDataOther.voterId), "El segon usuari no ha retornat voterId");
assert(
  voteDataOther.voterId !== voteData.voterId,
  "Dos usuaris diferents no poden compartir voterId"
);

const voteRes2 = await fetch(`${baseUrl}/api/public/vote`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    slug: pollSlug,
    voterName: "Test Smoke Editat",
    voterToken: voteData.voterToken,
    availabilityByOptionId: Object.fromEntries(optionIds.map((id) => [id, true])),
  }),
});

assert(voteRes2.ok, "El re-vot no ha retornat OK");
const voteData2 = await voteRes2.json();
assert(voteData2.voterId === voteData.voterId, "El re-vot no ha mantingut voterId");

const icsRes = await fetch(`${baseUrl}/api/public/ics?meetingId=${meetingId}`);
assert(icsRes.status === 401 || icsRes.status === 403, "ICS hauria d'estar protegit");

if (ownerEmail && ownerPassword) {
  const ownerIdToken = await signInEmulator(ownerEmail, ownerPassword);
  const ownerCookie = await createSession(ownerIdToken);

  const ownerDashboardRes = await fetch(`${baseUrl}/dashboard`, {
    headers: { cookie: ownerCookie },
  });
  assert(ownerDashboardRes.ok, "Dashboard owner no accessible després de login");

  const ownerIcsRes = await fetch(`${baseUrl}/api/public/ics?meetingId=${meetingId}`, {
    headers: { cookie: ownerCookie },
  });
  assert(ownerIcsRes.ok, "ICS owner no accessible amb sessió vàlida");
  assert((ownerIcsRes.headers.get("content-type") || "").includes("text/calendar"), "ICS content-type invàlid");

  const closePollRes = await fetch(`${baseUrl}/api/owner/close-poll`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: ownerCookie,
      origin: baseUrl,
    },
    body: JSON.stringify({
      pollId,
      winningOptionId: optionIds[0],
    }),
  });
  assert(closePollRes.ok, `Tancar votació ha fallat (${closePollRes.status})`);
  const closePollData = await closePollRes.json();
  assert(Boolean(closePollData.meetingId), "Tancar votació no ha retornat meetingId");

  const integratedMeetingId = closePollData.meetingId;
  const integratedMeetingSnap = await db.collection("meetings").doc(integratedMeetingId).get();
  assert(integratedMeetingSnap.exists, "La reunió integrada no s'ha persistit");
  const integratedMeeting = integratedMeetingSnap.data();
  assert(
    typeof integratedMeeting?.meetingUrl === "string" && integratedMeeting.meetingUrl.includes("mock.daily.local"),
    "La reunió integrada no té meetingUrl Daily"
  );
  assert(integratedMeeting?.recordingStatus === "none", "La reunió nova no arrenca en estat none");

  const startRecordingRes = await fetch(`${baseUrl}/api/owner/meetings/start-recording`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: ownerCookie,
      origin: baseUrl,
    },
    body: JSON.stringify({ meetingId: integratedMeetingId }),
  });
  assert(startRecordingRes.ok, `Start recording ha fallat (${startRecordingRes.status})`);

  const startedMeeting = await waitFor(async () => {
    const snap = await db.collection("meetings").doc(integratedMeetingId).get();
    const data = snap.data();
    return data?.recordingStatus === "recording" ? data : null;
  }, "La reunió no ha passat a estat recording");
  assert(startedMeeting.recordingUrl === null, "Start recording ha de netejar recordingUrl");

  const stopRecordingRes = await fetch(`${baseUrl}/api/owner/meetings/stop-recording`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: ownerCookie,
      origin: baseUrl,
    },
    body: JSON.stringify({ meetingId: integratedMeetingId }),
  });
  assert(stopRecordingRes.ok, `Stop recording ha fallat (${stopRecordingRes.status})`);

  await waitFor(async () => {
    const snap = await db.collection("meetings").doc(integratedMeetingId).get();
    return snap.data()?.recordingStatus === "processing";
  }, "La reunió no ha passat a estat processing després d'aturar la gravació");

  const webhookPayload = {
    event: "recording.ready-to-download",
    room_name: new URL(integratedMeeting.meetingUrl).pathname.replace(/^\/+/, ""),
    recording_id: `smoke-recording-${Date.now()}`,
    download_link: "https://daily.mock/recordings/smoke.mp4",
  };

  const webhookRes = await fetch(`${baseUrl}/api/webhooks/daily/recording-complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: "Bearer smoke-secret",
    },
    body: JSON.stringify(webhookPayload),
  });
  assert(webhookRes.ok, `Webhook Daily ha fallat (${webhookRes.status})`);
  const webhookData = await webhookRes.json();
  assert(webhookData.ok === true, "Webhook Daily no ha retornat ok=true");

  const ingestJob = await waitFor(async () => {
    const snap = await db
      .collection("meeting_ingest_jobs")
      .where("meetingId", "==", integratedMeetingId)
      .limit(1)
      .get();
    const doc = snap.docs[0];
    return doc ? { id: doc.id, ...doc.data() } : null;
  }, "No s'ha creat meeting_ingest_job");
  assert(
    ingestJob.status === "queued" || ingestJob.status === "processing" || ingestJob.status === "completed",
    "meeting_ingest_job amb estat invàlid"
  );

  const completedJob = await waitFor(async () => {
    const snap = await db.collection("meeting_ingest_jobs").doc(ingestJob.id).get();
    const data = snap.data();
    return data?.status === "completed" ? data : null;
  }, "meeting_ingest_job no ha arribat a completed");
  assert(completedJob.error === null, "meeting_ingest_job no ha d'acabar amb error");

  const completedMeeting = await waitFor(async () => {
    const snap = await db.collection("meetings").doc(integratedMeetingId).get();
    const data = snap.data();
    return data?.recordingStatus === "ready" && data?.transcript && data?.minutesDraft ? data : null;
  }, "La reunió no ha persistit transcript + minutesDraft");
  assert(typeof completedMeeting.transcript === "string", "La reunió no ha guardat transcript");
  assert(typeof completedMeeting.minutesDraft === "string", "La reunió no ha guardat minutesDraft");

  const duplicateWebhookRes = await fetch(`${baseUrl}/api/webhooks/daily/recording-complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: "Bearer smoke-secret",
    },
    body: JSON.stringify(webhookPayload),
  });
  assert(duplicateWebhookRes.ok, "Webhook duplicat ha fallat");
  const duplicateWebhookData = await duplicateWebhookRes.json();
  assert(duplicateWebhookData.duplicate === true, "El webhook duplicat no s'ha reconegut com a duplicat");

  const transcriptSnap = await db
    .collection("meetings")
    .doc(integratedMeetingId)
    .collection("transcripts")
    .doc(webhookPayload.recording_id)
    .get();
  assert(transcriptSnap.exists, "La transcripció no s'ha persistit");

  const minutesSnap = await db
    .collection("meetings")
    .doc(integratedMeetingId)
    .collection("minutes")
    .doc(webhookPayload.recording_id)
    .get();
  assert(minutesSnap.exists, "L'acta no s'ha persistit");

  const signupSuffix = Date.now();
  const signupOrg = `Entitat Smoke ${signupSuffix}`;
  const signupEmail = `owner-${signupSuffix}@summa.local`;
  const signupPassword = "12345678";

  const signupRes = await fetch(`${baseUrl}/api/auth/entity-signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: baseUrl },
    body: JSON.stringify({
      orgName: signupOrg,
      contactName: "Owner Smoke",
      email: signupEmail,
      password: signupPassword,
    }),
  });
  assert(signupRes.ok, `Alta d'entitat ha fallat (${signupRes.status})`);
  const signupData = await signupRes.json();
  assert(signupData.ok === true, "Alta d'entitat sense resposta ok=true");

  const secondOwnerIdToken = await signInEmulator(signupEmail, signupPassword);
  const secondOwnerCookie = await createSession(secondOwnerIdToken);

  const secondDashboardRes = await fetch(`${baseUrl}/dashboard`, {
    headers: { cookie: secondOwnerCookie },
  });
  assert(secondDashboardRes.ok, "Dashboard del nou owner no accessible");
  const secondDashboardHtml = await secondDashboardRes.text();
  assert(secondDashboardHtml.includes(signupOrg), "El dashboard del nou owner no mostra el nom de la seva entitat");
  assert(!secondDashboardHtml.includes("Junta mensual"), "El nou owner veu dades d'una altra entitat");

  const crossPollRes = await fetch(`${baseUrl}/polls/${pollId}`, {
    headers: { cookie: secondOwnerCookie },
    redirect: "manual",
  });
  assert(crossPollRes.status === 404, "Aïllament trencat: una entitat pot obrir la votació d'una altra");

  const logoutRes = await fetch(`${baseUrl}/api/auth/session-logout`, {
    method: "POST",
    headers: { cookie: ownerCookie, origin: baseUrl },
  });
  assert(logoutRes.ok, "Logout API ha fallat");

  const revokedDashboardRes = await fetch(`${baseUrl}/dashboard`, {
    headers: { cookie: ownerCookie },
    redirect: "manual",
  });
  const revokedLocation = revokedDashboardRes.headers.get("location");
  assert(
    (revokedDashboardRes.status === 307 || revokedDashboardRes.status === 303) &&
      (revokedLocation === "/login" || revokedLocation === "/ca/login" || revokedLocation === "/es/login"),
    "Logout no revoca la sessió al servidor"
  );
}

console.log("Smoke OK");

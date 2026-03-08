import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const baseUrl = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";
const authBase = process.env.VERIFY_AUTH_BASE || "http://127.0.0.1:9099";
const expectRoom = process.env.VERIFY_EXPECT_ROOM === "true";
const cleanupDaily = process.env.VERIFY_CLEANUP_DAILY === "true";
const expectedErrorText = process.env.VERIFY_EXPECT_ERROR_TEXT || "";

const seed = JSON.parse(await fs.readFile("scripts/.seed-output.json", "utf8"));
const app = getApps()[0] || initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
const db = getFirestore(app);

async function signInEmulator(email, password) {
  const res = await fetch(
    `${authBase}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  assert.equal(res.ok, true, `Auth emulator ha fallat (${res.status})`);
  return (await res.json()).idToken;
}

async function createSession(idToken) {
  const res = await fetch(`${baseUrl}/api/auth/session-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: baseUrl },
    body: JSON.stringify({ idToken }),
  });
  assert.equal(res.ok, true, `Session login ha fallat (${res.status})`);
  const cookie = res.headers.get("set-cookie");
  assert.equal(Boolean(cookie), true, "No s'ha rebut session cookie");
  return cookie;
}

const idToken = await signInEmulator(seed.owner.email, seed.owner.password);
const cookie = await createSession(idToken);

const closeRes = await fetch(`${baseUrl}/api/owner/close-poll`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    cookie,
    origin: baseUrl,
  },
  body: JSON.stringify({
    pollId: seed.poll.pollId,
    winningOptionId: seed.poll.optionIds[0],
  }),
});

const closeBody = await closeRes.json();
assert.equal(closeRes.ok, true, `Close poll ha fallat (${closeRes.status})`);
assert.equal(typeof closeBody.meetingId, "string", "Close poll no ha retornat meetingId");

const meetingId = closeBody.meetingId;
const meetingSnap = await db.collection("meetings").doc(meetingId).get();
assert.equal(meetingSnap.exists, true, "La reunió integrada no s'ha persistit");
const meeting = meetingSnap.data();

const pageRes = await fetch(`${baseUrl}/owner/meetings/${meetingId}`, {
  headers: {
    cookie,
    "accept-language": "ca",
  },
});
assert.equal(pageRes.ok, true, `Meeting page ha fallat (${pageRes.status})`);
const pageHtml = await pageRes.text();
const meetingLinkVisible =
  typeof meeting?.dailyRoomUrl === "string" &&
  pageHtml.includes(`href=\"${meeting.dailyRoomUrl}\"`) &&
  pageHtml.includes("Entrar a la reunió");

if (expectRoom) {
  assert.equal(typeof meeting?.dailyRoomName, "string", "dailyRoomName absent");
  assert.equal(typeof meeting?.dailyRoomUrl, "string", "dailyRoomUrl absent");
  assert.equal(meeting?.meetingUrl, meeting?.dailyRoomUrl, "meetingUrl no replica dailyRoomUrl");
  assert.equal(meetingLinkVisible, true, "El botó principal no és visible");
} else {
  assert.equal(meeting?.dailyRoomName, null, "dailyRoomName hauria de ser null");
  assert.equal(meeting?.dailyRoomUrl, null, "dailyRoomUrl hauria de ser null");
  assert.equal(meeting?.meetingUrl, null, "meetingUrl hauria de ser null");
  if (expectedErrorText) {
    assert.equal(
      pageHtml.includes(expectedErrorText),
      true,
      "La UI no mostra el missatge accionable esperat"
    );
  }
}

let cleanupStatus = null;
if (cleanupDaily && meeting?.dailyRoomName && process.env.DAILY_API_KEY) {
  const cleanupRes = await fetch(`https://api.daily.co/v1/rooms/${meeting.dailyRoomName}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
  });
  cleanupStatus = cleanupRes.status;
}

console.log(
  JSON.stringify(
    {
      closeStatus: closeRes.status,
      meetingId,
      dailyRoomName: meeting?.dailyRoomName ?? null,
      dailyRoomUrl: meeting?.dailyRoomUrl ?? null,
      meetingUrl: meeting?.meetingUrl ?? null,
      actionableErrorVisible: expectedErrorText ? pageHtml.includes(expectedErrorText) : null,
      enterMeetingVisible: expectRoom ? meetingLinkVisible : null,
      cleanupStatus,
    },
    null,
    2
  )
);

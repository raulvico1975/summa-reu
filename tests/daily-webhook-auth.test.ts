import assert from "node:assert/strict";
import test from "node:test";

const {
  buildDailyWebhookSignature,
  isAuthorizedDailyWebhook,
} = await import("../src/lib/meetings/daily.ts");

test("daily webhook accepts HMAC signatures signed with the shared secret", () => {
  const sharedSecret = Buffer.from("daily-shared-secret").toString("base64");
  const rawBody = JSON.stringify({
    event: "recording.ready-to-download",
    room_name: "meeting-demo",
  });

  const signature = buildDailyWebhookSignature(rawBody, sharedSecret);
  const accepted = isAuthorizedDailyWebhook({
    authHeader: null,
    signatureHeader: signature,
    rawBody,
    sharedSecret,
  });

  assert.equal(accepted, true);
});

test("daily webhook keeps bearer auth support for smoke and manual checks", () => {
  const accepted = isAuthorizedDailyWebhook({
    authHeader: "Bearer smoke-secret",
    signatureHeader: null,
    rawBody: "{}",
    sharedSecret: "smoke-secret",
  });

  assert.equal(accepted, true);
});

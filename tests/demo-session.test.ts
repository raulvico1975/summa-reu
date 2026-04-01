import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_DEMO_OWNER_UID, getDemoSessionUid } from "@/src/lib/firebase/demo-session";

test("demo session cookie resolves outside production", () => {
  const uid = getDemoSessionUid("demo:owner-123", {
    demoOwnerUid: "owner-123",
    nodeEnv: "development",
  });

  assert.equal(uid, "owner-123");
});

test("demo session cookie is ignored in production", () => {
  const uid = getDemoSessionUid("demo:owner-123", {
    demoOwnerUid: "owner-123",
    nodeEnv: "production",
  });

  assert.equal(uid, null);
});

test("demo session cookie ignores mismatched values", () => {
  const uid = getDemoSessionUid("demo:other-owner", {
    demoOwnerUid: "owner-123",
    nodeEnv: "development",
  });

  assert.equal(uid, null);
});

test("demo session cookie uses the default demo owner uid when env is missing", () => {
  const uid = getDemoSessionUid(`demo:${DEFAULT_DEMO_OWNER_UID}`, {
    nodeEnv: "development",
  });

  assert.equal(uid, DEFAULT_DEMO_OWNER_UID);
});

test("demo session cookie accepts URL-encoded values", () => {
  const uid = getDemoSessionUid(`demo%3A${DEFAULT_DEMO_OWNER_UID}`, {
    nodeEnv: "development",
  });

  assert.equal(uid, DEFAULT_DEMO_OWNER_UID);
});

test("demo session cookie is disabled in production unless explicitly enabled", () => {
  const original = process.env.DEMO_SESSION_ALLOW_PRODUCTION;
  delete process.env.DEMO_SESSION_ALLOW_PRODUCTION;

  try {
    const disabled = getDemoSessionUid(`demo:${DEFAULT_DEMO_OWNER_UID}`, {
      nodeEnv: "production",
    });

    assert.equal(disabled, null);

    process.env.DEMO_SESSION_ALLOW_PRODUCTION = "true";
    const enabled = getDemoSessionUid(`demo:${DEFAULT_DEMO_OWNER_UID}`, {
      nodeEnv: "production",
    });

    assert.equal(enabled, DEFAULT_DEMO_OWNER_UID);
  } finally {
    if (original === undefined) {
      delete process.env.DEMO_SESSION_ALLOW_PRODUCTION;
    } else {
      process.env.DEMO_SESSION_ALLOW_PRODUCTION = original;
    }
  }
});

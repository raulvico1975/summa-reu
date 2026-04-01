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

import assert from "node:assert/strict";
import test from "node:test";
import { getDemoSessionUid } from "@/src/lib/firebase/demo-session";

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

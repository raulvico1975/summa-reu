import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

test("root layout keeps owner session safety and owner navigation shortcuts", async () => {
  const source = await fs.readFile("app/layout.tsx", "utf8");

  assert.equal(source.includes('import { SessionIdleManager } from "@/src/components/session/session-idle-manager";'), true);
  assert.equal(source.includes("<SessionIdleManager enabled={Boolean(owner)} />"), true);
  assert.equal(source.includes('href={withLocalePath(locale, "/settings")}'), true);
  assert.equal(source.includes('href={withLocalePath(locale, "/help")}'), true);
});

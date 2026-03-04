import crypto from "node:crypto";
import { adminDb } from "@/src/lib/firebase/admin";
import { consumeRateLimit as consumeRateLimitMemory } from "@/src/lib/rate-limit";

type RateLimitDoc = {
  count: number;
  resetAt: number;
  updatedAt: number;
};

const col = adminDb.collection("_rate_limits");

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 40);
}

export async function consumeRateLimitServer(
  key: string,
  maxHits = 20,
  windowMs = 5 * 60_000
): Promise<boolean> {
  const now = Date.now();
  const docId = hashKey(key);
  const ref = col.doc(docId);

  try {
    return await adminDb.runTransaction(async (trx) => {
      const snap = await trx.get(ref);
      if (!snap.exists) {
        trx.set(ref, {
          count: 1,
          resetAt: now + windowMs,
          updatedAt: now,
        } satisfies RateLimitDoc);
        return true;
      }

      const data = snap.data() as Partial<RateLimitDoc>;
      const resetAt = typeof data.resetAt === "number" ? data.resetAt : 0;
      const count = typeof data.count === "number" ? data.count : 0;

      if (resetAt <= now) {
        trx.set(ref, {
          count: 1,
          resetAt: now + windowMs,
          updatedAt: now,
        } satisfies RateLimitDoc);
        return true;
      }

      if (count >= maxHits) {
        return false;
      }

      trx.update(ref, {
        count: count + 1,
        updatedAt: now,
      });
      return true;
    });
  } catch {
    return consumeRateLimitMemory(`fallback:${key}`, maxHits, windowMs);
  }
}

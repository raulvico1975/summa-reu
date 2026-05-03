type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitState = Map<string, RateLimitBucket>;

export type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __summaApiRateLimitState: RateLimitState | undefined;
}

function getRateLimitState(): RateLimitState {
  if (!globalThis.__summaApiRateLimitState) {
    globalThis.__summaApiRateLimitState = new Map();
  }
  return globalThis.__summaApiRateLimitState;
}

function pruneExpiredRateLimitBuckets(state: RateLimitState, nowMs: number): void {
  for (const [bucketKey, bucket] of state) {
    if (bucket.resetAt <= nowMs) {
      state.delete(bucketKey);
    }
  }
}

export function checkRateLimit({
  key,
  limit,
  windowMs,
  nowMs = Date.now(),
}: RateLimitOptions): RateLimitResult {
  const state = getRateLimitState();
  pruneExpiredRateLimitBuckets(state, nowMs);
  const existing = state.get(key);

  if (!existing || existing.resetAt <= nowMs) {
    const resetAt = nowMs + windowMs;
    state.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(limit - 1, 0),
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(limit - existing.count, 0),
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  };
}

export function clearRateLimitStateForTests(): void {
  globalThis.__summaApiRateLimitState = new Map();
}

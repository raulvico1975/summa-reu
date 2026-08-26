type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Removes undefined object fields recursively before a Firestore write.
 * Undefined array entries are compacted, matching the existing safe-write
 * contract. Non-plain objects (timestamps, sentinels, Dates, etc.) are kept.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined || value === null) return value;

  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) {
      const cleaned = stripUndefinedDeep(item);
      if (cleaned !== undefined) out.push(cleaned);
    }
    return out as T;
  }

  if (isPlainObject(value)) {
    const out: PlainObject = {};
    for (const [key, nested] of Object.entries(value)) {
      const cleaned = stripUndefinedDeep(nested);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out as T;
  }

  return value;
}

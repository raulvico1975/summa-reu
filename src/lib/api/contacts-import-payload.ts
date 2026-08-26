type PlainObject = Record<string, unknown>;

import { stripUndefinedDeep } from '@/lib/strip-undefined-deep';

function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function sanitizeContactImportData(data: unknown): PlainObject {
  if (!isPlainObject(data)) {
    throw new Error('Contact update data must be a plain object');
  }

  const sanitized = stripUndefinedDeep(data) as PlainObject;
  delete sanitized.archivedAt;
  delete sanitized.archivedByUid;
  delete sanitized.archivedFromAction;
  return sanitized;
}

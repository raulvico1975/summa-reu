type PlainObject = Record<string, unknown>;

import { stripUndefinedDeep as stripUndefinedDeepValue } from '@/lib/strip-undefined-deep';

export type SafeWriteSource = 'system' | 'import' | 'user';

export interface SafeWriteContext {
  updatedBy?: string | null;
  source: SafeWriteSource;
  updatedAtFactory?: () => unknown;
  requiredFields?: string[];
  amountFields?: string[];
}

export interface WriteMeta {
  updatedAt: unknown;
  updatedBy: string;
  source: SafeWriteSource;
}

interface SafeWriteInternalArgs<T extends PlainObject> {
  data: T;
  context: SafeWriteContext;
}

interface SafeWriteArgs<T extends PlainObject, R> extends SafeWriteInternalArgs<T> {
  write: (payload: T & { writeMeta: WriteMeta }) => Promise<R> | R;
}

export class SafeWriteValidationError extends Error {
  readonly code = 'SAFE_WRITE_INVALID_PAYLOAD';

  constructor(message: string) {
    super(message);
    this.name = 'SafeWriteValidationError';
  }
}

function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function getByPath(data: unknown, path: string): unknown {
  const segments = path.split('.').map((s) => s.trim()).filter(Boolean);
  let current: unknown = data;

  for (const segment of segments) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as PlainObject)[segment];
  }

  return current;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function validateFiniteNumbersDeep(value: unknown, path = 'payload'): void {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new SafeWriteValidationError(`${path} conté un número no finit (NaN/Infinity)`);
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => validateFiniteNumbersDeep(item, `${path}[${index}]`));
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, nested] of Object.entries(value)) {
      validateFiniteNumbersDeep(nested, `${path}.${key}`);
    }
  }
}

function validateRequiredFields(data: PlainObject, fields: string[]): void {
  for (const fieldPath of fields) {
    const value = getByPath(data, fieldPath);
    if (isEmptyValue(value)) {
      throw new SafeWriteValidationError(`Camp obligatori buit: ${fieldPath}`);
    }
  }
}

function validateAmountFields(data: PlainObject, fields: string[]): void {
  for (const fieldPath of fields) {
    const value = getByPath(data, fieldPath);
    if (isEmptyValue(value)) {
      throw new SafeWriteValidationError(`Import buit o absent: ${fieldPath}`);
    }
  }
}

function withWriteMeta<T extends PlainObject>(
  payload: T,
  context: SafeWriteContext
): T & { writeMeta: WriteMeta } {
  const baseMeta = isPlainObject(payload.writeMeta) ? payload.writeMeta : {};
  const updatedAt = context.updatedAtFactory ? context.updatedAtFactory() : new Date().toISOString();

  return {
    ...payload,
    writeMeta: {
      ...baseMeta,
      updatedAt,
      updatedBy: context.updatedBy ?? 'system',
      source: context.source,
    },
  };
}

function preparePayload<T extends PlainObject>({
  data,
  context,
}: SafeWriteInternalArgs<T>): T & { writeMeta: WriteMeta } {
  if (!isPlainObject(data)) {
    throw new SafeWriteValidationError('Payload invàlid: ha de ser un objecte');
  }

  const cleaned = stripUndefinedDeepValue(data) as T;
  validateFiniteNumbersDeep(cleaned);

  if (context.requiredFields && context.requiredFields.length > 0) {
    validateRequiredFields(cleaned, context.requiredFields);
  }
  if (context.amountFields && context.amountFields.length > 0) {
    validateAmountFields(cleaned, context.amountFields);
  }

  return withWriteMeta(cleaned, context);
}

async function runSafeWrite<T extends PlainObject, R>({
  data,
  context,
  write,
}: SafeWriteArgs<T, R>): Promise<R> {
  const payload = preparePayload({ data, context });
  return write(payload);
}

export async function safeSet<T extends PlainObject, R = void>(
  args: SafeWriteArgs<T, R>
): Promise<R> {
  return runSafeWrite(args);
}

export async function safeUpdate<T extends PlainObject, R = void>(
  args: SafeWriteArgs<T, R>
): Promise<R> {
  return runSafeWrite(args);
}

export async function safeAdd<T extends PlainObject, R>(
  args: SafeWriteArgs<T, R>
): Promise<R> {
  return runSafeWrite(args);
}

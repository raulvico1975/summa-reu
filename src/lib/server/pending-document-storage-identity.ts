const ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;

export interface PendingDocumentStorageIdentity {
  filename: string;
  originalPathPrefix: string;
  originalPath: string;
  finalPath: string;
}

export function buildPendingDocumentStorageIdentity(input: {
  orgId: string;
  pendingDocumentId: string;
  transactionId: string;
  filename: unknown;
}): PendingDocumentStorageIdentity | null {
  const { orgId, pendingDocumentId, transactionId } = input;
  if (![orgId, pendingDocumentId, transactionId].every((value) => ID_PATTERN.test(value))) {
    return null;
  }

  if (typeof input.filename !== 'string') return null;
  const filename = input.filename.trim();
  if (
    filename.length < 1
    || filename.length > 240
    || filename !== input.filename
    || filename === '.'
    || filename === '..'
    || filename.includes('/')
    || filename.includes('\\')
    || CONTROL_CHAR_PATTERN.test(filename)
  ) {
    return null;
  }

  return {
    filename,
    originalPathPrefix: `organizations/${orgId}/pendingDocuments/${pendingDocumentId}/`,
    originalPath: `organizations/${orgId}/pendingDocuments/${pendingDocumentId}/${filename}`,
    finalPath: `organizations/${orgId}/documents/${transactionId}/${pendingDocumentId}--${filename}`,
  };
}

export function pendingDocumentStoragePathsMatch(input: {
  identity: PendingDocumentStorageIdentity;
  originalPath: unknown;
  finalPath?: unknown;
}): boolean {
  const originalPath = typeof input.originalPath === 'string' ? input.originalPath : '';
  const originalBasename = originalPath.startsWith(input.identity.originalPathPrefix)
    ? originalPath.slice(input.identity.originalPathPrefix.length)
    : '';
  const validOriginalBasename = originalBasename.length >= 1
    && originalBasename.length <= 240
    && originalBasename !== '.'
    && originalBasename !== '..'
    && !originalBasename.includes('/')
    && !originalBasename.includes('\\')
    && !CONTROL_CHAR_PATTERN.test(originalBasename);
  return validOriginalBasename
    && (input.finalPath === undefined
      || input.finalPath === null
      || input.finalPath === ''
      || input.finalPath === input.identity.finalPath);
}

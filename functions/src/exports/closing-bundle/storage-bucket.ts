/**
 * Utilitats per comparar i resoldre buckets de Firebase Storage.
 *
 * Alguns entorns exposen el bucket com `*.appspot.com` i altres com
 * `*.firebasestorage.app`. Per al Closing Bundle els considerem equivalents
 * si apunten al mateix projecte base.
 */

function normalizeBucketName(bucket: string | null | undefined): string | null {
  if (!bucket) return null;

  const trimmed = bucket.trim();
  if (!trimmed) return null;

  return trimmed
    .replace(/^gs:\/\//, '')
    .replace(/\.appspot\.com$/i, '')
    .replace(/\.firebasestorage\.app$/i, '');
}

export function areEquivalentStorageBuckets(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  if (!left || !right) return false;
  if (left === right) return true;

  const normalizedLeft = normalizeBucketName(left);
  const normalizedRight = normalizeBucketName(right);

  return !!normalizedLeft && normalizedLeft === normalizedRight;
}

export function resolveDocumentBucketName(
  documentBucket: string | null | undefined,
  configuredBucket: string | null | undefined
): string | null {
  return documentBucket || configuredBucket || null;
}

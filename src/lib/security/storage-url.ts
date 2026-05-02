export const MAX_AI_IMAGE_BYTES = 10 * 1024 * 1024;

export type FirebaseStorageDownloadUrl = {
  bucket: string;
  storagePath: string;
};

export function isOrgStoragePath(storagePath: unknown, orgId: string): storagePath is string {
  if (typeof storagePath !== 'string') return false;
  if (!storagePath || storagePath.includes('\0')) return false;
  if (storagePath.includes('..')) return false;
  return storagePath.startsWith(`organizations/${orgId}/`);
}

export function parseFirebaseStorageDownloadUrl(fileUrl: string): FirebaseStorageDownloadUrl | null {
  let url: URL;
  try {
    url = new URL(fileUrl);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com') {
    return null;
  }

  const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/([^/]+)$/);
  if (!match) return null;

  try {
    return {
      bucket: decodeURIComponent(match[1]),
      storagePath: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}

export function isExpectedFirebaseStorageBucket(bucket: string): boolean {
  const expectedBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  return !expectedBucket || bucket === expectedBucket;
}

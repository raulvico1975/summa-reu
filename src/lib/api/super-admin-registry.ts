import type { Firestore } from 'firebase-admin/firestore';

export async function isSuperAdminInRegistry(
  db: Pick<Firestore, 'doc'>,
  uid: string | null | undefined
): Promise<boolean> {
  if (!uid) return false;

  try {
    const superAdminSnap = await db.doc(`systemSuperAdmins/${uid}`).get();
    return superAdminSnap.exists;
  } catch (error) {
    console.warn('[super-admin-registry] Error verificant SuperAdmin:', error);
    return false;
  }
}

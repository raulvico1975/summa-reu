/**
 * Helpers compartits per a rutes API que usen Firebase Admin SDK.
 *
 * Centralitza: inicialització cached, verificació de token, validació de membership.
 *
 * @see CLAUDE.md secció 2.b — paths `src/app/api/**` són RISC ALT
 */

import { type NextRequest } from 'next/server';
import { initializeApp, getApps, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { isSuperAdminInRegistry } from '@/lib/api/super-admin-registry';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Grandària dels batches — invariant Summa: ≤ 50 operacions per batch */
export const BATCH_SIZE = 50;

// =============================================================================
// FIREBASE ADMIN INITIALIZATION (singleton cached)
// =============================================================================

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;

export function getAdminApp(): App {
  if (cachedApp) return cachedApp;

  if (getApps().length === 0) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      throw new Error('Firebase config incompleta per Admin SDK');
    }

    const storageBucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (!storageBucket) {
      throw new Error(
        'Missing FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
      );
    }

    cachedApp = initializeApp({
      credential: applicationDefault(),
      projectId,
      storageBucket,
    });
  } else {
    cachedApp = getApps()[0];
  }

  return cachedApp;
}

export function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb;
  getAdminApp();
  cachedDb = getFirestore();
  return cachedDb;
}

export function getAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  getAdminApp();
  cachedAuth = getAuth();
  return cachedAuth;
}

// =============================================================================
// AUTENTICACIÓ
// =============================================================================

export interface AuthResult {
  uid: string;
  email?: string;
}

/**
 * Verifica el Bearer token d'una request i retorna uid + email.
 * Retorna null si no hi ha token o és invàlid.
 */
export async function verifyIdToken(request: NextRequest): Promise<AuthResult | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const idToken = authHeader.substring(7);
  if (!idToken) {
    return null;
  }

  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
  } catch (error) {
    console.error('[admin-sdk] Error verificant token:', error);
    return null;
  }
}

// =============================================================================
// MEMBERSHIP
// =============================================================================

export interface MembershipValidation {
  valid: boolean;
  role: 'admin' | 'user' | 'viewer' | null;
  userOverrides: { deny?: string[] } | null;
  userGrants: string[] | null;
}

/**
 * Valida que un usuari és membre d'una organització o és SuperAdmin.
 *
 * Ordre de verificació:
 * 1. Comprova si és membre de l'organització → retorna rol real
 * 2. Comprova si és SuperAdmin (systemSuperAdmins/{uid}) → retorna 'admin'
 * 3. Si cap dels dos → retorna invalid
 */
export async function validateUserMembership(
  db: Firestore,
  uid: string,
  orgId: string
): Promise<MembershipValidation> {
  const memberSnap = await db
    .doc(`organizations/${orgId}/members/${uid}`)
    .get();

  if (memberSnap.exists) {
    const data = memberSnap.data();
    return {
      valid: true,
      role: (data?.role as 'admin' | 'user' | 'viewer') ?? 'viewer',
      userOverrides: data?.userOverrides && typeof data.userOverrides === 'object'
        ? (data.userOverrides as { deny?: string[] })
        : null,
      userGrants: Array.isArray(data?.userGrants)
        ? data.userGrants.filter((value): value is string => typeof value === 'string')
        : null,
    };
  }

  // SuperAdmin bypass: accés admin a totes les organitzacions
  const superAdminSnap = await db.doc(`systemSuperAdmins/${uid}`).get();
  if (superAdminSnap.exists) {
    return { valid: true, role: 'admin', userOverrides: null, userGrants: null };
  }

  return { valid: false, role: null, userOverrides: null, userGrants: null };
}

// =============================================================================
// SUPERADMIN
// =============================================================================

/**
 * Verifica si un UID és SuperAdmin.
 *
 * En backend real, només compta el registre Firestore systemSuperAdmins/{uid}.
 */
export async function isSuperAdmin(uid: string): Promise<boolean> {
  const db = getAdminDb();
  return isSuperAdminInRegistry(db, uid);
}

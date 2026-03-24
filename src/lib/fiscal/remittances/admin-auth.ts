/**
 * Helpers d'autenticació per API routes de remeses
 *
 * Centralitza la lògica de:
 * - Verificació de token Firebase
 * - Validació de membre admin d'una organització
 */

import { NextRequest } from 'next/server';
import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { isSuperAdminInRegistry } from '@/lib/api/super-admin-registry';

// =============================================================================
// FIREBASE ADMIN INITIALIZATION (lazy, cached, idempotent)
// =============================================================================

let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;

export function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb;

  if (getApps().length === 0) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      throw new Error('Firebase config incompleta per Admin SDK');
    }

    initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  cachedDb = getFirestore();
  return cachedDb;
}

export function getAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  getAdminDb();
  cachedAuth = getAuth();
  return cachedAuth;
}

// =============================================================================
// TIPUS
// =============================================================================

export interface AuthResult {
  uid: string;
  email?: string;
}

export interface AdminAuthResult {
  success: true;
  uid: string;
  email?: string;
  db: Firestore;
}

export interface AdminAuthError {
  success: false;
  error: string;
  code: string;
  status: number;
}

type MemberData = Record<string, unknown> | null;

function isAdminLikeRole(role: unknown): boolean {
  if (typeof role !== 'string') return false;
  const normalized = role.trim().toLowerCase();
  return normalized === 'admin' || normalized === 'superadmin';
}

async function isGlobalSuperAdmin(db: Firestore, uid: string): Promise<boolean> {
  return isSuperAdminInRegistry(db, uid);
}

async function loadMemberData(
  db: Firestore,
  orgId: string,
  uid: string
): Promise<MemberData> {
  const memberRef = db.doc(`organizations/${orgId}/members/${uid}`);
  const memberSnap = await memberRef.get();

  let memberData: MemberData = memberSnap.exists
    ? ((memberSnap.data() as Record<string, unknown> | undefined) ?? null)
    : null;

  // Fallback: buscar per userId (compatibilitat)
  if (!memberData) {
    const membersQuery = db
      .collection(`organizations/${orgId}/members`)
      .where('userId', '==', uid)
      .limit(1);
    const membersSnap = await membersQuery.get();

    if (!membersSnap.empty) {
      memberData = (membersSnap.docs[0].data() as Record<string, unknown> | undefined) ?? null;
    }
  }

  return memberData;
}

export interface VerifyAdminMembershipDeps {
  verifyIdTokenFn?: (request: NextRequest) => Promise<AuthResult | null>;
  getAdminDbFn?: () => Firestore;
  loadMemberDataFn?: (db: Firestore, orgId: string, uid: string) => Promise<MemberData>;
  isGlobalSuperAdminFn?: (db: Firestore, uid: string) => Promise<boolean>;
}

// =============================================================================
// FUNCIONS
// =============================================================================

/**
 * Verifica el token ID de Firebase de la request
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
    console.error('[admin-auth] Error verificant token:', error);
    return null;
  }
}

/**
 * Verifica que l'usuari és admin d'una organització
 *
 * Retorna:
 * - success: true amb uid, email i db si l'usuari és admin
 * - success: false amb error, code i status si no ho és
 */
export async function verifyAdminMembership(
  request: NextRequest,
  orgId: string,
  deps: VerifyAdminMembershipDeps = {}
): Promise<AdminAuthResult | AdminAuthError> {
  const verifyIdTokenFn = deps.verifyIdTokenFn ?? verifyIdToken;
  const getAdminDbFn = deps.getAdminDbFn ?? getAdminDb;
  const loadMemberDataFn = deps.loadMemberDataFn ?? loadMemberData;
  const isGlobalSuperAdminFn = deps.isGlobalSuperAdminFn ?? isGlobalSuperAdmin;

  // 1. Verificar token
  const authResult = await verifyIdTokenFn(request);
  if (!authResult) {
    return {
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
      status: 401,
    };
  }

  // 2. Verificar membre admin
  const db = getAdminDbFn();
  const memberData = await loadMemberDataFn(db, orgId, authResult.uid);

  const hasAdminMembership = isAdminLikeRole(memberData?.role);
  if (hasAdminMembership || (await isGlobalSuperAdminFn(db, authResult.uid))) {
    return {
      success: true,
      uid: authResult.uid,
      email: authResult.email,
      db,
    };
  }

  if (memberData) {
    return {
      success: false,
      error: 'Només els admins poden fer aquesta operació',
      code: 'NOT_ADMIN',
      status: 403,
    };
  }

  return {
    success: false,
    error: "No ets membre d'aquesta organització",
    code: 'NOT_MEMBER',
    status: 403,
  };
}

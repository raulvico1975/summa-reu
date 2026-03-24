/**
 * API route per descarregar backup local d'una organització
 *
 * GET /api/admin/orgs/{orgId}/backup/local
 *
 * Regles:
 * 1. Requereix header Authorization: Bearer <idToken>
 * 2. Verifica el token amb Admin SDK i comprova que l'UID és SuperAdmin
 * 3. Retorna JSON amb Content-Disposition per descarregar
 *
 * Només SuperAdmin pot executar aquesta operació.
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { exportOrganizationBackup } from '@/lib/admin/org-backup-export';
import { isSuperAdminInRegistry } from '@/lib/api/super-admin-registry';

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Admin initialization (lazy, cached, idempotent)
// ─────────────────────────────────────────────────────────────────────────────

let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;

function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb;

  if (getApps().length === 0) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (!projectId || !storageBucket) {
      throw new Error('Firebase config incompleta per Admin SDK');
    }

    initializeApp({
      credential: applicationDefault(),
      projectId,
      storageBucket,
    });

    console.log('[backup/local] Firebase Admin inicialitzat amb ADC');
  }

  cachedDb = getFirestore();
  return cachedDb;
}

function getAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  // Assegurar que Firebase està inicialitzat
  getAdminDb();
  cachedAuth = getAuth();
  return cachedAuth;
}

// ─────────────────────────────────────────────────────────────────────────────
// Autenticació segura via Firebase ID Token
// ─────────────────────────────────────────────────────────────────────────────

interface AuthResult {
  uid: string;
  email?: string;
}

async function verifyIdToken(request: NextRequest): Promise<AuthResult | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.warn('[backup/local] Missing or invalid Authorization header');
    return null;
  }

  const idToken = authHeader.substring(7);
  if (!idToken) {
    console.warn('[backup/local] Empty ID token');
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
    console.error('[backup/local] Error verificant ID token:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificació SuperAdmin
// ─────────────────────────────────────────────────────────────────────────────

async function verifySuperAdmin(uid: string): Promise<boolean> {
  try {
    const db = getAdminDb();
    if (await isSuperAdminInRegistry(db, uid)) {
      console.log('[backup/local] SuperAdmin verificat via Firestore');
      return true;
    }
  } catch (error) {
    console.warn('[backup/local] No es pot verificar via Firestore:', error);
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  // 1. Verificar ID Token
  const authResult = await verifyIdToken(request);
  if (!authResult) {
    return NextResponse.json(
      { error: 'No autoritzat (token invàlid o absent)' },
      { status: 401 }
    );
  }

  // 2. Verificar SuperAdmin
  const isSuperAdmin = await verifySuperAdmin(authResult.uid);
  if (!isSuperAdmin) {
    console.warn('[backup/local] Accés denegat per UID:', authResult.uid);
    return NextResponse.json(
      { error: 'No autoritzat (no és SuperAdmin)' },
      { status: 403 }
    );
  }

  // 3. Validar orgId
  if (!orgId || typeof orgId !== 'string' || orgId.length < 10) {
    return NextResponse.json(
      { error: 'orgId invàlid' },
      { status: 400 }
    );
  }

  // 4. Executar backup
  const startTime = Date.now();
  try {
    const db = getAdminDb();

    // Log sense dades sensibles
    console.log('[backup/local] Iniciant backup per orgId:', orgId);

    const { filename, payload } = await exportOrganizationBackup(db, orgId);

    const durationMs = Date.now() - startTime;
    console.log('[backup/local] Backup completat en', durationMs, 'ms - Counts:', JSON.stringify(payload.counts));

    // Retornar JSON amb header de descàrrega
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = (error as Error).message;
    console.error('[backup/local] Error després de', durationMs, 'ms:', errorMessage);

    // Missatges accionables per errors comuns
    let userMessage = 'Error generant backup';
    let hint: string | undefined;

    if (errorMessage.includes('Could not load the default credentials')) {
      userMessage = 'Credencials ADC no configurades';
      hint = 'Executa "gcloud auth application-default login" i reinicia.';
    } else if (errorMessage.includes('PERMISSION_DENIED')) {
      userMessage = 'Permisos insuficients al projecte Firebase';
    } else if (errorMessage.includes('no trobada')) {
      userMessage = errorMessage;
    }

    return NextResponse.json(
      {
        ok: false,
        error: userMessage,
        hint,
        durationMs,
      },
      { status: 500 }
    );
  }
}

/**
 * Endpoint per regenerar dades demo
 *
 * POST /api/internal/demo/seed
 *
 * Regles:
 * 1. Només funciona si APP_ENV === 'demo' (404 en altres entorns)
 * 2. Requereix header Authorization: Bearer <idToken> amb Firebase ID Token
 * 3. Verifica el token amb Admin SDK i comprova que l'UID és SuperAdmin
 * 4. Executa seed amb Admin SDK (via ADC)
 *
 * Retorna: { ok: true, counts: { donors, suppliers, ... } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth, type Auth } from 'firebase-admin/auth';
import type { Bucket } from '@google-cloud/storage';
import { isDemoEnv } from '@/lib/demo/isDemoOrg';
import type { DemoMode } from '@/scripts/demo/seed-demo';

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Admin initialization (lazy, cached, idempotent)
// Utilitza ADC (Application Default Credentials) via gcloud auth
// ─────────────────────────────────────────────────────────────────────────────

let cachedDb: Firestore | null = null;
let cachedBucket: Bucket | null = null;
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

    console.log('[demo/seed] Firebase Admin inicialitzat amb ADC');
  }

  cachedDb = getFirestore();
  return cachedDb;
}

function getAdminStorage(): Bucket {
  if (cachedBucket) return cachedBucket;
  // Assegurar que Firebase està inicialitzat
  getAdminDb();
  cachedBucket = getStorage().bucket();
  return cachedBucket;
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
    console.warn('[demo/seed] Missing or invalid Authorization header');
    return null;
  }

  const idToken = authHeader.substring(7);
  if (!idToken) {
    console.warn('[demo/seed] Empty ID token');
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
    console.error('[demo/seed] Error verificant ID token:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificació SuperAdmin
// ─────────────────────────────────────────────────────────────────────────────

async function verifySuperAdmin(uid: string): Promise<boolean> {
  // Opció 1: Verificar via SUPER_ADMIN_UID configurat a .env.demo
  const envSuperAdminUid = process.env.SUPER_ADMIN_UID;
  if (envSuperAdminUid && uid === envSuperAdminUid) {
    console.log('[demo/seed] SuperAdmin verificat via SUPER_ADMIN_UID env');
    return true;
  }

  // Opció 2: Verificar a Firestore (col·lecció systemSuperAdmins)
  try {
    const db = getAdminDb();
    const superAdminDoc = await db.doc(`systemSuperAdmins/${uid}`).get();
    if (superAdminDoc.exists) {
      console.log('[demo/seed] SuperAdmin verificat via Firestore');
      return true;
    }
  } catch (error) {
    console.warn('[demo/seed] No es pot verificar via Firestore:', error);
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed Demo Data
// ─────────────────────────────────────────────────────────────────────────────

interface SeedCounts {
  donors: number;
  suppliers: number;
  workers: number;
  bankAccounts: number;
  categories: number;
  transactions: number;
  projects: number;
  budgetLines: number;
  projectExpensesFeed: number;
  offBankExpenses: number;
  expenseLinks: number;
  pdfs: number;
}

async function seedDemoData(demoMode: DemoMode = 'short'): Promise<SeedCounts> {
  const db = getAdminDb();
  const bucket = getAdminStorage();

  // Import dinàmic del seeder per evitar carregar-lo en prod
  const { runDemoSeed } = await import('@/scripts/demo/seed-demo');

  return runDemoSeed(db, bucket, demoMode);
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Verificar entorn DEMO
  if (!isDemoEnv()) {
    // Retornem 404 per no exposar que l'endpoint existeix en prod
    return new NextResponse('Not Found', { status: 404 });
  }

  // 2. Verificar ID Token (auth segura, no falsificable)
  const authResult = await verifyIdToken(request);
  if (!authResult) {
    return NextResponse.json(
      { error: 'No autoritzat (token invàlid o absent)' },
      { status: 401 }
    );
  }

  // 3. Verificar SuperAdmin
  const isSuperAdmin = await verifySuperAdmin(authResult.uid);
  if (!isSuperAdmin) {
    return NextResponse.json(
      { error: 'No autoritzat (no és SuperAdmin)' },
      { status: 403 }
    );
  }

  // 4. Parsejar i validar demoMode del body (estricte)
  let demoMode: DemoMode = 'short';
  try {
    const body = await request.json();
    if (body.demoMode !== undefined) {
      if (body.demoMode === 'work' || body.demoMode === 'short') {
        demoMode = body.demoMode;
      } else {
        // Valor invàlid explícit → 400
        return NextResponse.json(
          {
            error: 'Valor demoMode invàlid',
            expected: "'short' | 'work'",
            received: String(body.demoMode),
          },
          { status: 400 }
        );
      }
    }
  } catch {
    // Body buit o no JSON → default 'short' (acceptat)
  }

  // 5. Executar seed
  const startTime = Date.now();
  try {
    // Log sense tokens ni dades sensibles
    console.log('[demo/seed] Iniciant seed demo - Mode:', demoMode);
    const counts = await seedDemoData(demoMode);
    const durationMs = Date.now() - startTime;
    console.log('[demo/seed] Seed completat en', durationMs, 'ms');

    return NextResponse.json(
      {
        ok: true,
        demoMode,
        counts,
        durationMs,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    // Log error sense stack complet (seguretat)
    console.error('[demo/seed] Error després de', durationMs, 'ms:', (error as Error).message);

    // Missatges accionables per errors comuns
    const errorMessage = (error as Error).message;
    let userMessage = 'Error executant seed';
    let hint: string | undefined;

    if (errorMessage.includes('Could not load the default credentials') ||
        errorMessage.includes('GOOGLE_APPLICATION_CREDENTIALS')) {
      userMessage = 'Credencials ADC no configurades';
      hint = 'Executa "gcloud auth application-default login" i reinicia.';
    } else if (errorMessage.includes('PERMISSION_DENIED')) {
      userMessage = 'Permisos insuficients al projecte Firebase';
      hint = 'Verifica que el teu compte té accés a summa-social-demo.';
    } else if (errorMessage.includes('invariant failed')) {
      userMessage = 'El seed ha fallat una validació interna';
      hint = errorMessage; // El missatge d'invariant és útil
    }

    return NextResponse.json(
      {
        ok: false,
        error: userMessage,
        hint,
        demoMode,
        durationMs,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// GET retorna info sobre l'endpoint (només en demo)
export async function GET() {
  if (!isDemoEnv()) {
    return new NextResponse('Not Found', { status: 404 });
  }

  return NextResponse.json({
    endpoint: '/api/internal/demo/seed',
    method: 'POST',
    description: 'Regenera dades demo (requereix SuperAdmin)',
    auth: {
      type: 'Firebase ID Token',
      header: 'Authorization: Bearer <idToken>',
      note: 'El token ha de pertànyer a un SuperAdmin',
    },
    body: {
      demoMode: "'short' | 'work' (default: 'short')",
      short: 'Dades netes per vídeos/pitch',
      work: 'Dades amb anomalies per validar workflows',
    },
    backend: 'Utilitza gcloud ADC (gcloud auth application-default login)',
  });
}

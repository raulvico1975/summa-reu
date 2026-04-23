/**
 * POST /api/pending-documents/relink-document
 *
 * Re-vincula el document d'un pending document a la transacció bancària conciliada.
 * Només copia el document, no modifica conciliació ni estats.
 *
 * Input: { orgId, pendingId }
 *
 * Característiques:
 * - Idempotent: si el document ja existeix a la transacció, retorna OK
 * - NO modifica pending.status ni pending.matchedTransactionId
 * - Només membres de l'organització poden executar
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth, type Auth } from 'firebase-admin/auth';
import type { Bucket } from '@google-cloud/storage';
import { safeUpdate, SafeWriteValidationError } from '@/lib/safe-write';

// =============================================================================
// FIREBASE ADMIN INITIALIZATION
// =============================================================================

let cachedDb: Firestore | null = null;
let cachedBucket: Bucket | null = null;
let cachedAuth: Auth | null = null;

/**
 * Resol el nom del bucket de Storage amb fallback chain:
 * 1. NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 * 2. FIREBASE_STORAGE_BUCKET
 * 3. admin.app().options.storageBucket
 */
function getBucketName(): string {
  // 1. Variable d'entorn pública
  const envPublic = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (envPublic) return envPublic;

  // 2. Variable d'entorn privada
  const envPrivate = process.env.FIREBASE_STORAGE_BUCKET;
  if (envPrivate) return envPrivate;

  // 3. Configuració de l'app Admin
  const apps = getApps();
  if (apps.length > 0) {
    const appOptions = apps[0].options as { storageBucket?: string };
    if (appOptions.storageBucket) return appOptions.storageBucket;
  }

  throw new Error('[relink-document] No s\'ha pogut determinar el bucket de Storage. Configura NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.');
}

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
  }

  cachedDb = getFirestore();
  return cachedDb;
}

function getAdminStorage(): Bucket {
  if (cachedBucket) return cachedBucket;
  getAdminDb();
  // Bucket EXPLÍCIT per evitar defaults incorrectes
  const bucketName = getBucketName();
  cachedBucket = getStorage().bucket(bucketName);
  return cachedBucket;
}

function getAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  getAdminDb();
  cachedAuth = getAuth();
  return cachedAuth;
}

// =============================================================================
// AUTENTICACIÓ
// =============================================================================

interface AuthResult {
  uid: string;
  email?: string;
}

async function verifyIdToken(request: NextRequest): Promise<AuthResult | null> {
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
    console.error('[relink-document] Error verificant token:', error);
    return null;
  }
}

// =============================================================================
// TIPUS
// =============================================================================

interface RelinkDocumentRequest {
  orgId: string;
  pendingId: string;
}

interface RelinkDocumentResponse {
  success: boolean;
  idempotent?: boolean;
  error?: string;
  code?: string;
}

interface RelinkDocumentDeps {
  verifyIdTokenFn?: (request: NextRequest) => Promise<AuthResult | null>;
  getAdminDbFn?: () => Firestore;
  getAdminStorageFn?: () => Bucket;
}

function getOrganizationStoragePrefix(orgId: string): string {
  return `organizations/${orgId}/`;
}

// =============================================================================
// HELPER: Validar membership
// =============================================================================

async function validateUserMembership(
  db: Firestore,
  uid: string,
  orgId: string
): Promise<boolean> {
  const memberRef = db.doc(`organizations/${orgId}/members/${uid}`);
  const memberSnap = await memberRef.get();
  return memberSnap.exists;
}

// =============================================================================
// HANDLER PRINCIPAL
// =============================================================================

export async function handleRelinkDocumentPost(
  request: NextRequest,
  deps: RelinkDocumentDeps = {}
): Promise<NextResponse<RelinkDocumentResponse>> {
  const logPrefix = '[relink-document]';
  const verifyIdTokenFn = deps.verifyIdTokenFn ?? verifyIdToken;
  const getAdminDbFn = deps.getAdminDbFn ?? getAdminDb;
  const getAdminStorageFn = deps.getAdminStorageFn ?? getAdminStorage;

  // 1. Autenticació
  const authResult = await verifyIdTokenFn(request);
  if (!authResult) {
    return NextResponse.json(
      { success: false, error: 'No autenticat', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const { uid } = authResult;
  const db = getAdminDbFn();
  const bucket = getAdminStorageFn();

  // 2. Parse body
  let body: RelinkDocumentRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Body invàlid', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const { orgId, pendingId } = body;

  // 3. Validar camps obligatoris
  if (!orgId || !pendingId) {
    return NextResponse.json(
      { success: false, error: 'orgId i pendingId són obligatoris', code: 'MISSING_PARAMS' },
      { status: 400 }
    );
  }

  // 4. Validar membership
  const isMember = await validateUserMembership(db, uid, orgId);
  if (!isMember) {
    return NextResponse.json(
      { success: false, error: 'No ets membre d\'aquesta organització', code: 'NOT_MEMBER' },
      { status: 403 }
    );
  }

  // 5. Carregar pending document
  const pendingRef = db.doc(`organizations/${orgId}/pendingDocuments/${pendingId}`);
  const pendingSnap = await pendingRef.get();

  if (!pendingSnap.exists) {
    return NextResponse.json(
      { success: false, error: 'Document pendent no existeix', code: 'PENDING_NOT_FOUND' },
      { status: 404 }
    );
  }

  const pendingData = pendingSnap.data();

  // 6. Validar que té matchedTransactionId (està conciliat)
  const bankTxId = pendingData?.matchedTransactionId;
  if (!bankTxId) {
    return NextResponse.json(
      { success: false, error: 'El document no està conciliat amb cap moviment', code: 'NOT_MATCHED' },
      { status: 400 }
    );
  }

  // 7. Validar que té filename
  const filename = pendingData?.file?.filename;

  if (!filename) {
    console.error(`${logPrefix} INCIDENT_MISSING_FILENAME: pendingId=${pendingId}, orgId=${orgId}`);
    return NextResponse.json(
      { success: false, error: 'Incidència: document del pendent no té filename', code: 'MISSING_DOCUMENT' },
      { status: 400 }
    );
  }

  // 8. Validar que la transacció existeix
  const txRef = db.doc(`organizations/${orgId}/transactions/${bankTxId}`);
  const txSnap = await txRef.get();

  if (!txSnap.exists) {
    return NextResponse.json(
      { success: false, error: 'La transacció bancària no existeix', code: 'TX_NOT_FOUND' },
      { status: 404 }
    );
  }

  const txData = txSnap.data();

  // 9. Idempotència: si ja té document, comprovar si és el mateix
  if (txData?.document) {
    // Ja té document vinculat - considerem idempotent
    console.log(`${logPrefix} Transacció ${bankTxId} ja té document (idempotent)`);
    return NextResponse.json({
      success: true,
      idempotent: true,
    });
  }

  // 10. Cercar fitxer origen amb path determinista (ordre de prioritat)
  // destPath: ubicació final on ha d'estar el document (font estable)
  // candidateFinal: finalStoragePath guardat prèviament (si existeix)
  // candidateA: storagePath original guardat a Firestore
  // candidateB: path canònic construït a partir de {orgId, pendingId, filename}
  const orgStoragePrefix = getOrganizationStoragePrefix(orgId);
  const destPath = `organizations/${orgId}/documents/${bankTxId}/${filename}`;
  const candidateFinal = pendingData?.file?.finalStoragePath || null;
  const candidateA = pendingData?.file?.storagePath || null;
  const candidateB = `organizations/${orgId}/pendingDocuments/${pendingId}/${filename}`;

  if (typeof candidateFinal === 'string' && candidateFinal && !candidateFinal.startsWith(orgStoragePrefix)) {
    console.error(`${logPrefix} FORBIDDEN_STORAGE_PATH candidateFinal=${candidateFinal} orgId=${orgId}`);
    return NextResponse.json(
      {
        success: false,
        error: 'El document pendent referencia un fitxer fora de la seva organització.',
        code: 'PENDING_DOCUMENT_FILE_FORBIDDEN',
      },
      { status: 403 }
    );
  }

  if (typeof candidateA === 'string' && candidateA && !candidateA.startsWith(orgStoragePrefix)) {
    console.error(`${logPrefix} FORBIDDEN_STORAGE_PATH candidateA=${candidateA} orgId=${orgId}`);
    return NextResponse.json(
      {
        success: false,
        error: 'El document pendent referencia un fitxer fora de la seva organització.',
        code: 'PENDING_DOCUMENT_FILE_FORBIDDEN',
      },
      { status: 403 }
    );
  }

  // Log diagnòstic (només en dev)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`${logPrefix} [DIAG] bucket: ${bucket.name}`);
    console.log(`${logPrefix} [DIAG] pendingData.file:`, JSON.stringify(pendingData?.file, null, 2));
    console.log(`${logPrefix} [DIAG] destPath: "${destPath}"`);
    console.log(`${logPrefix} [DIAG] candidateFinal (finalStoragePath): "${candidateFinal}"`);
    console.log(`${logPrefix} [DIAG] candidateA (storagePath): "${candidateA}"`);
    console.log(`${logPrefix} [DIAG] candidateB (canònic): "${candidateB}"`);
  }

  let sourceStoragePath: string | null = null;
  let alreadyAtDestination = false;
  const writeContextBase = {
    updatedBy: uid,
    source: 'user' as const,
    updatedAtFactory: () => FieldValue.serverTimestamp(),
  };

  try {
    // 1. Primer comprovar si el fitxer ja existeix al destí final (ruta estable)
    const destFile = bucket.file(destPath);
    const [destExists] = await destFile.exists();
    if (destExists) {
      sourceStoragePath = destPath;
      alreadyAtDestination = true;
      if (process.env.NODE_ENV !== 'production') {
        console.log(`${logPrefix} [DIAG] Ja existeix al destí: ${destPath}`);
      }
    }

    // 2. Provar candidateFinal (finalStoragePath guardat prèviament)
    if (!sourceStoragePath && candidateFinal && candidateFinal !== destPath) {
      const fileFinal = bucket.file(candidateFinal);
      const [existsFinal] = await fileFinal.exists();
      if (existsFinal) {
        sourceStoragePath = candidateFinal;
        if (process.env.NODE_ENV !== 'production') {
          console.log(`${logPrefix} [DIAG] Trobat a candidateFinal: ${candidateFinal}`);
        }
      }
    }

    // 3. Provar candidateA (storagePath original)
    if (!sourceStoragePath && candidateA && candidateA !== destPath && candidateA !== candidateFinal) {
      const fileA = bucket.file(candidateA);
      const [existsA] = await fileA.exists();
      if (existsA) {
        sourceStoragePath = candidateA;
        if (process.env.NODE_ENV !== 'production') {
          console.log(`${logPrefix} [DIAG] Trobat a candidateA: ${candidateA}`);
        }
      }
    }

    // 4. Provar candidateB (path canònic)
    if (!sourceStoragePath && candidateB !== destPath && candidateB !== candidateFinal && candidateB !== candidateA) {
      const fileB = bucket.file(candidateB);
      const [existsB] = await fileB.exists();
      if (existsB) {
        sourceStoragePath = candidateB;
        if (process.env.NODE_ENV !== 'production') {
          console.log(`${logPrefix} [DIAG] Trobat a candidateB: ${candidateB}`);
        }
      }
    }

    // Si cap candidat existeix, retornar error amb diagnòstic
    if (!sourceStoragePath) {
      console.error(`${logPrefix} INCIDENT_MISSING_DOCUMENT:`);
      console.error(`${logPrefix}   bucket: ${bucket.name}`);
      console.error(`${logPrefix}   destPath: "${destPath}" (no trobat)`);
      console.error(`${logPrefix}   candidateFinal: "${candidateFinal}" (no trobat)`);
      console.error(`${logPrefix}   candidateA: "${candidateA}" (no trobat)`);
      console.error(`${logPrefix}   candidateB: "${candidateB}" (no trobat)`);
      return NextResponse.json(
        { success: false, error: 'Incidència: document del pendent no trobat a Storage', code: 'MISSING_DOCUMENT' },
        { status: 400 }
      );
    }

    // 11. Copiar fitxer a la ubicació de la transacció (si no ja hi és)
    if (!alreadyAtDestination) {
      const sourceFile = bucket.file(sourceStoragePath);
      console.log(`${logPrefix} Copiant: ${sourceStoragePath} -> ${destPath}`);
      await sourceFile.copy(destFile);
    } else {
      console.log(`${logPrefix} Fitxer ja existeix al destí, no cal copiar`);
    }

    // Obtenir URL pública (signada)
    const [signedUrl] = await destFile.getSignedUrl({
      action: 'read',
      expires: '03-01-2500', // URL de llarga durada
    });

    // 12. Actualitzar la transacció amb el document
    await safeUpdate({
      data: {
        document: signedUrl,
        updatedAt: FieldValue.serverTimestamp(),
      },
      context: writeContextBase,
      write: async (payload) => {
        await txRef.update(payload);
      },
    });

    // 13. Guardar finalStoragePath al pending document (font estable per futures operacions)
    if (!alreadyAtDestination || !pendingData?.file?.finalStoragePath) {
      await safeUpdate({
        data: {
          'file.finalStoragePath': destPath,
        },
        context: writeContextBase,
        write: async (payload) => {
          await pendingRef.update(payload);
        },
      });
      console.log(`${logPrefix} Guardat file.finalStoragePath: ${destPath}`);
    }

    console.log(`${logPrefix} Document re-vinculat: pendingId=${pendingId}, bankTxId=${bankTxId}, filename=${filename}`);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    if (error instanceof SafeWriteValidationError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: 400 }
      );
    }

    console.error(`${logPrefix} Error copiant fitxer:`, error);
    return NextResponse.json(
      { success: false, error: 'Error copiant el document', code: 'COPY_ERROR' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<RelinkDocumentResponse>> {
  return handleRelinkDocumentPost(request);
}

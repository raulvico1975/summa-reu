/**
 * Cloud Function: exportClosingBundleZip
 *
 * Genera un ZIP amb el paquet de tancament per streaming.
 * - POST amb Authorization: Bearer <FirebaseIdToken>
 * - Body: { orgId, dateFrom, dateTo }
 * - Resposta: ZIP stream o JSON error
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import archiver from 'archiver';
import type { Response } from 'express';

import {
  ClosingBundleRequest,
  ClosingBundleError,
  ClosingBundleMode,
  DocumentStatusCounts,
} from './closing-bundle/closing-types';
import {
  loadTransactions,
  sortTransactions,
  detectIncidents,
  prepareDocuments,
  prepareDiagnostics,
  validateLimits,
  buildManifestRows,
  loadCategoryMap,
  loadContactMap,
} from './closing-bundle/build-closing-data';
import {
  buildClosingBundleEntries,
  buildClosingBundleManifest,
  buildDebugSummaryText,
  buildIncidentRows,
  buildSummaryText,
  buildVisibleIncidents,
  DebugRow,
} from './closing-bundle/build-closing-artifacts';
import { canGenerateClosingBundle } from './closing-bundle/closing-permissions';
import { inferExtension, buildDocumentFileName } from './closing-bundle/normalize-filename';

const db = admin.firestore();

/**
 * Genera un ID únic per a aquesta execució (per correlacionar logs).
 */
function generateRunId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${date}-${time}-${random}`;
}

/**
 * Envia una resposta d'error JSON.
 */
function sendError(res: Response, status: number, error: ClosingBundleError): void {
  res.status(status).json(error);
}

/**
 * Valida el format de data YYYY-MM-DD.
 */
function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export const exportClosingBundleZip = functions
  .region('europe-west1')
  .runWith({
    timeoutSeconds: 360, // 6 minuts
    memory: '1GB',
  })
  .https.onRequest(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    // OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // Només POST
    if (req.method !== 'POST') {
      res.status(405).json({ code: 'INVALID_REQUEST', message: 'Mètode no permès' });
      return;
    }

    // 1. Extreure token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      sendError(res, 401, { code: 'UNAUTHENTICATED', message: 'Token no proporcionat' });
      return;
    }

    const idToken = authHeader.slice(7);

    // 2. Verificar token
    let uid: string;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (err) {
      functions.logger.warn('[closingBundleZip] Token invàlid', err);
      sendError(res, 401, { code: 'UNAUTHENTICATED', message: 'Token invàlid' });
      return;
    }

    // 3. Parsejar body
    let body: ClosingBundleRequest;
    try {
      body = req.body as ClosingBundleRequest;
    } catch {
      sendError(res, 400, { code: 'INVALID_REQUEST', message: 'Body invàlid' });
      return;
    }

    const { orgId, dateFrom, dateTo } = body;
    // Guardrail server-side: aquest endpoint només exposa el mode segur d'usuari.
    const mode: ClosingBundleMode = 'user';

    // Validar camps
    if (!orgId || typeof orgId !== 'string') {
      sendError(res, 400, { code: 'INVALID_REQUEST', message: 'orgId és obligatori' });
      return;
    }

    if (!dateFrom || !isValidDate(dateFrom)) {
      sendError(res, 400, { code: 'INVALID_REQUEST', message: 'dateFrom invàlid (format YYYY-MM-DD)' });
      return;
    }

    if (!dateTo || !isValidDate(dateTo)) {
      sendError(res, 400, { code: 'INVALID_REQUEST', message: 'dateTo invàlid (format YYYY-MM-DD)' });
      return;
    }

    // 4. Verificar permisos efectius de l'usuari
    try {
      const memberRef = db.doc(`organizations/${orgId}/members/${uid}`);
      const memberSnap = await memberRef.get();

      const superAdminSnap = memberSnap.exists
        ? null
        : await db.doc(`systemSuperAdmins/${uid}`).get();

      if (!canGenerateClosingBundle({
        memberData: memberSnap.exists ? memberSnap.data() : null,
        isSystemSuperAdmin: !!superAdminSnap?.exists,
      })) {
        sendError(
          res,
          403,
          { code: 'UNAUTHORIZED', message: memberSnap.exists ? 'No tens permisos per generar aquest paquet' : 'No ets membre d\'aquesta organització' }
        );
        return;
      }
    } catch (err) {
      functions.logger.error('[closingBundleZip] Error verificant permisos', err);
      sendError(res, 500, { code: 'INTERNAL_ERROR', message: 'Error verificant permisos' });
      return;
    }

    // 5. Obtenir orgSlug
    let orgSlug = orgId;
    try {
      const orgSnap = await db.doc(`organizations/${orgId}`).get();
      if (orgSnap.exists) {
        orgSlug = (orgSnap.data()?.slug as string) || orgId;
      }
    } catch {
      // Usar orgId com a fallback
    }

    // Generar runId per correlació de logs
    const runId = generateRunId();

    functions.logger.info(`[closingBundleZip][${runId}] Iniciant generació`, { orgId, dateFrom, dateTo, uid });

    try {
      // 6. Carregar transaccions i mapes de resolució en paral·lel
      const [rawTransactions, categoryMap, contactMap] = await Promise.all([
        loadTransactions(orgId, dateFrom, dateTo),
        loadCategoryMap(orgId),
        loadContactMap(orgId),
      ]);

      if (rawTransactions.length === 0) {
        sendError(res, 400, { code: 'NO_TRANSACTIONS', message: 'No hi ha moviments en aquest període' });
        return;
      }

      // 7. Ordenar
      const transactions = sortTransactions(rawTransactions);

      // 8. Detectar incidències
      const incidents = detectIncidents(transactions);

      // 9. Obtenir bucket configurat
      const bucketName =
        (admin.app().options as { storageBucket?: string }).storageBucket ||
        process.env.FIREBASE_STORAGE_BUCKET;

      functions.logger.info(`[closingBundleZip][${runId}] storageBucket`, {
        storageBucket: bucketName,
        appOptions: (admin.app().options as { storageBucket?: string }).storageBucket,
        envBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });

      if (!bucketName) {
        functions.logger.error(`[closingBundleZip][${runId}] Missing storageBucket config`);
        sendError(res, 500, { code: 'INTERNAL_ERROR', message: 'Storage bucket no configurat' });
        return;
      }

      // 10. Preparar diagnòstics per a totes les transaccions
      const diagnostics = prepareDiagnostics(transactions, bucketName);

      // 11. Preparar documents (només els que tenen path vàlid i no bucket mismatch)
      const { docs, txWithDoc } = prepareDocuments(transactions, diagnostics);

      // 12. Validar límits
      const { error: limitError } = await validateLimits(docs);
      if (limitError) {
        sendError(res, 400, { code: 'LIMIT_EXCEEDED', message: limitError });
        return;
      }

      // 13. Iniciar streaming del ZIP
      const fileName = `summa_tancament_${orgSlug}_${dateFrom}_${dateTo}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('error', (err) => {
        functions.logger.error(`[closingBundleZip][${runId}] Error archiver`, err);
      });

      archive.pipe(res);

      const downloadedTxIds = new Set<string>();

      // 14. Descarregar documents amb exists() previ
      for (const docInfo of docs) {
        const diagnostic = diagnostics.get(docInfo.txId);
        if (!diagnostic) continue;

        try {
          const bucket = docInfo.bucketName
            ? admin.storage().bucket(docInfo.bucketName)
            : admin.storage().bucket(bucketName);
          const file = bucket.file(docInfo.storagePath);

          // Verificar existència abans de descarregar
          const [exists] = await file.exists();
          if (!exists) {
            diagnostic.status = 'NOT_FOUND';
            diagnostic.errorCode = 'FILE_NOT_EXISTS';
            diagnostic.errorMessage = 'El fitxer no existeix al bucket';
            diagnostic.errorAt = new Date().toISOString();
            functions.logger.warn(`[closingBundleZip][${runId}] Fitxer no existeix`, {
              txId: docInfo.txId,
              storagePath: docInfo.storagePath,
            });
            continue;
          }

          // Descarregar
          const [buffer] = await file.download();

          // Actualitzar extensió si tenim contentType
          let finalFileName = docInfo.fileName;
          if (docInfo.contentType) {
            const ext = inferExtension(docInfo.contentType, docInfo.storagePath);
            finalFileName = buildDocumentFileName({
              ordre: docInfo.ordre,
              date: transactions.find((t) => t.id === docInfo.txId)?.date || '',
              amount: transactions.find((t) => t.id === docInfo.txId)?.amount || 0,
              concept: transactions.find((t) => t.id === docInfo.txId)?.description || '',
              txId: docInfo.txId,
              extension: ext,
            });
          }

          archive.append(buffer, { name: `documents/${finalFileName}` });
          downloadedTxIds.add(docInfo.txId);
          docInfo.fileName = finalFileName;
          diagnostic.status = 'OK';
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown';
          const errorCode = err instanceof Error && 'code' in err ? String(err.code) : 'UNKNOWN';
          diagnostic.status = 'DOWNLOAD_ERROR';
          diagnostic.errorCode = errorCode;
          diagnostic.errorMessage = errorMessage;
          diagnostic.errorAt = new Date().toISOString();
          functions.logger.warn(`[closingBundleZip][${runId}] Error descarregant document`, {
            txId: docInfo.txId,
            storagePath: docInfo.storagePath,
            rawDocumentValue: diagnostic.rawDocumentValue,
            errorCode,
            errorMessage,
          });
        }
      }

      // 15. Calcular estadístiques per status
      const statusCounts: DocumentStatusCounts = {
        ok: 0,
        noDocument: 0,
        urlNotParseable: 0,
        bucketMismatch: 0,
        notFound: 0,
        downloadError: 0,
      };

      for (const diagnostic of diagnostics.values()) {
        switch (diagnostic.status) {
          case 'OK':
            statusCounts.ok++;
            break;
          case 'NO_DOCUMENT':
            statusCounts.noDocument++;
            break;
          case 'URL_NOT_PARSEABLE':
            statusCounts.urlNotParseable++;
            break;
          case 'BUCKET_MISMATCH':
            statusCounts.bucketMismatch++;
            break;
          case 'NOT_FOUND':
            statusCounts.notFound++;
            break;
          case 'DOWNLOAD_ERROR':
            statusCounts.downloadError++;
            break;
        }
      }

      const totalIncome = transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
      const totalExpense = transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0);
      const totalWithDocRef = transactions.filter((t) => t.document).length;
      const finalIncidents = buildVisibleIncidents(transactions, incidents, diagnostics);
      const generatedAt = new Date().toISOString();

      const manifestRows = buildManifestRows(transactions, txWithDoc, downloadedTxIds, categoryMap, contactMap);
      const manifestRowsByTxId = new Map(
        manifestRows.map((row) => [
          row.txId,
          {
            ordre: row.ordre,
            data: row.data,
            import: row.import,
            concepte: row.concepte,
            categoria: row.categoria,
            contacte: row.contacte,
          },
        ])
      );
      const incidentRows = buildIncidentRows(finalIncidents, manifestRowsByTxId, diagnostics);
      const manifestJson = buildClosingBundleManifest({
        runId,
        generatedAt,
        orgSlug,
        dateFrom,
        dateTo,
        totalTransactions: transactions.length,
        totalIncome,
        totalExpense,
        totalWithDocRef,
        totalIncluded: downloadedTxIds.size,
        totalIncidents: finalIncidents.length,
        statusCounts,
      });
      const summaryText = buildSummaryText({
        runId,
        orgSlug,
        dateFrom,
        dateTo,
        totalTransactions: transactions.length,
        totalIncome,
        totalExpense,
        totalWithDocRef,
        totalIncluded: downloadedTxIds.size,
        statusCounts,
        totalIncidents: finalIncidents.length,
      });
      const debugSummaryText = buildDebugSummaryText({
        runId,
        orgSlug,
        dateFrom,
        dateTo,
        totalTransactions: transactions.length,
        totalWithDocRef,
        totalIncluded: downloadedTxIds.size,
        statusCounts,
      });
      const debugRows: DebugRow[] = transactions.map((tx) => {
        const diagnostic = diagnostics.get(tx.id);
        return {
          txId: tx.id,
          rawDocumentValue: diagnostic?.rawDocumentValue || null,
          extractedPath: diagnostic?.extractedPath || null,
          bucketConfigured: diagnostic?.bucketConfigured || null,
          bucketInUrl: diagnostic?.bucketInUrl || null,
          status: diagnostic?.status || 'NO_DOCUMENT',
          kind: diagnostic?.kind || null,
          errorCode: diagnostic?.errorCode || null,
          errorMessage: diagnostic?.errorMessage || null,
          errorAt: diagnostic?.errorAt || null,
        };
      });

      const entries = buildClosingBundleEntries({
        mode,
        orgSlug,
        dateFrom,
        dateTo,
        manifestRows,
        incidentRows,
        debugRows,
        manifest: manifestJson,
        summaryText,
        debugSummaryText,
      });

      for (const entry of entries) {
        archive.append(entry.content, { name: entry.name });
      }

      // 23. Finalitzar ZIP
      await archive.finalize();

      functions.logger.info(`[closingBundleZip][${runId}] Generat amb èxit`, {
        orgId,
        mode,
        transactions: transactions.length,
        documentsIncluded: downloadedTxIds.size,
        statusCounts,
        incidents: finalIncidents.length,
      });
    } catch (err) {
      functions.logger.error(`[closingBundleZip][${runId}] Error intern`, err);

      if (!res.headersSent) {
        sendError(res, 500, { code: 'INTERNAL_ERROR', message: 'Error intern generant el paquet' });
      }
    }
  });

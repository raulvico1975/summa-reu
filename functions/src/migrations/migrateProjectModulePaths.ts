import * as admin from "firebase-admin";
import { createHash, randomUUID } from "node:crypto";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;

interface MigrationResult {
  success: boolean;
  migrated: number;
  errors: string[];
  details: Array<{
    orgId: string;
    orgName: string;
    projectId: string;
    projectName: string;
    status: "migrated" | "skipped" | "error";
    message?: string;
  }>;
}

interface MigrationContextLike { auth?: { uid: string } | null }
export type MigrationErrorCode =
  | "unauthenticated"
  | "invalid-argument"
  | "permission-denied"
  | "not-found"
  | "already-exists"
  | "aborted"
  | "failed-precondition";

export class MigrationError extends Error {
  constructor(public readonly code: MigrationErrorCode, message: string) {
    super(message);
    this.name = "MigrationError";
  }
}

type MigrationErrorFactory = (code: MigrationErrorCode, message: string) => Error;
type MigrationLogger = (message: string, details: Record<string, unknown>) => void;

interface MigrationSnapshotLike {
  exists: boolean;
  id?: string;
  data?(): Record<string, unknown> | undefined;
}
interface MigrationCollectionLike {
  get(): Promise<{ size: number; docs: Array<{ id: string; data(): Record<string, unknown>; ref: MigrationDocumentLike }> }>;
  doc(id: string): MigrationDocumentLike;
}
interface MigrationDocumentLike {
  get(): Promise<MigrationSnapshotLike>;
  collection(name: string): MigrationCollectionLike;
}
interface MigrationTransactionLike {
  get(ref: MigrationDocumentLike): Promise<MigrationSnapshotLike>;
  create(ref: MigrationDocumentLike, data: Record<string, unknown>): void;
  delete(ref: MigrationDocumentLike): void;
  set(ref: MigrationDocumentLike, data: Record<string, unknown>, options?: { merge: boolean }): void;
}
interface MigrationDbLike {
  doc(path: string): MigrationDocumentLike;
  runTransaction<T>(callback: (transaction: MigrationTransactionLike) => Promise<T>): Promise<T>;
}

function migrationError(
  code: MigrationErrorCode,
  message: string,
  factory?: MigrationErrorFactory,
): Error {
  return factory?.(code, message) ?? new MigrationError(code, message);
}

const MIGRATION_KIND = "project-module-paths-v1";
const MIGRATION_LEASE_MS = 5 * 60 * 1000;

function requestFingerprint(input: { orgId: string; dryRun: boolean; reason: string }): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function handleMigrateProjectModulePaths(
  data: unknown,
  context: MigrationContextLike,
  deps?: {
    db?: MigrationDbLike;
    now?: () => number;
    runToken?: () => string;
    errorFactory?: MigrationErrorFactory;
    logger?: MigrationLogger;
  }
): Promise<MigrationResult> {
  if (!context.auth) {
    throw migrationError("unauthenticated", "Usuari no autenticat", deps?.errorFactory);
  }
  const payload = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
  if (Object.keys(payload).some((key) => !["orgId", "dryRun", "reason", "idempotencyKey"].includes(key))) {
    throw migrationError("invalid-argument", "Camps no admesos", deps?.errorFactory);
  }
  const orgId = typeof payload.orgId === "string" ? payload.orgId.trim() : "";
  if (!ID_PATTERN.test(orgId)) {
    throw migrationError("invalid-argument", "orgId obligatori i invàlid", deps?.errorFactory);
  }
  if (payload.dryRun !== undefined && typeof payload.dryRun !== "boolean") {
    throw migrationError("invalid-argument", "dryRun ha de ser booleà", deps?.errorFactory);
  }
  const dryRun = payload.dryRun !== false;
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500) {
    throw migrationError("invalid-argument", "reason obligatori (3-500 caràcters)", deps?.errorFactory);
  }
  const idempotencyKey = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey.trim() : "";
  if (!ID_PATTERN.test(idempotencyKey)) {
    throw migrationError("invalid-argument", "idempotencyKey obligatori i invàlid", deps?.errorFactory);
  }

  const migrationDb = deps?.db ?? admin.firestore() as unknown as MigrationDbLike;
  const now = deps?.now?.() ?? Date.now();
  const runToken = deps?.runToken?.() ?? randomUUID();
  const superAdminSnap = await migrationDb.doc(`systemSuperAdmins/${context.auth.uid}`).get();
  if (!superAdminSnap.exists) {
    throw migrationError("permission-denied", "Accés exclusiu de SuperAdmin", deps?.errorFactory);
  }

  const orgRef = migrationDb.doc(`organizations/${orgId}`);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    throw migrationError("not-found", "Organització no trobada", deps?.errorFactory);
  }

  const auditRef = migrationDb.doc(`adminAuditLogs/project-module-migration_${idempotencyKey}`);
  const fingerprint = requestFingerprint({ orgId, dryRun, reason });
  const replay = await migrationDb.runTransaction(async (transaction) => {
    const auditSnap = await transaction.get(auditRef);
    if (!auditSnap.exists) {
      transaction.create(auditRef, {
        action: MIGRATION_KIND,
        target: `organizations/${orgId}`,
        organizationId: orgId,
        performedBy: context.auth!.uid,
        actorUid: context.auth!.uid,
        reason,
        dryRun,
        idempotencyKey,
        requestFingerprint: fingerprint,
        status: "started",
        activeRunToken: runToken,
        leaseExpiresAtMs: now + MIGRATION_LEASE_MS,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return null;
    }
    const audit = auditSnap.data?.() ?? {};
    if (audit.requestFingerprint !== fingerprint) {
      throw migrationError("already-exists", "idempotencyKey reutilitzat amb una petició diferent", deps?.errorFactory);
    }
    if (audit.status === "completed" && audit.result && typeof audit.result === "object") {
      return audit.result as MigrationResult;
    }
    const leaseExpiresAtMs = typeof audit.leaseExpiresAtMs === "number" ? audit.leaseExpiresAtMs : 0;
    if (leaseExpiresAtMs > now) {
      throw migrationError("aborted", "La mateixa migració ja està en curs", deps?.errorFactory);
    }
    transaction.set(auditRef, {
      status: "started",
      activeRunToken: runToken,
      leaseExpiresAtMs: now + MIGRATION_LEASE_MS,
      resumedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return null;
  });
  if (replay) return replay;

  const previousProjectResults = await auditRef.collection("projectResults").get();
  const previousDetails = previousProjectResults.docs
    .map((snapshot) => snapshot.data().detail)
    .filter((detail): detail is MigrationResult["details"][number] => Boolean(detail && typeof detail === "object"));
  const result: MigrationResult = {
    success: previousDetails.every((detail) => detail.status !== "error"),
    migrated: previousDetails.filter((detail) => detail.status === "migrated").length,
    errors: previousDetails
      .filter((detail) => detail.status === "error")
      .map((detail) => `Error migrant ${detail.projectId}: ${detail.message ?? "Unknown error"}`),
    details: previousDetails,
  };
  const previouslyProcessedIds = new Set(previousDetails.map((detail) => detail.projectId));
  const orgNameValue = orgSnap.data?.()?.name;
  const orgName = typeof orgNameValue === "string" && orgNameValue.trim() ? orgNameValue : orgId;
  const moduleSnapshot = await orgRef.collection("projectModule").get();

  for (const moduleDoc of moduleSnapshot.docs) {
    if (moduleDoc.id === "_") continue;
    if (previouslyProcessedIds.has(moduleDoc.id)) continue;
    const docData = moduleDoc.data();
    const projectName = typeof docData.name === "string" ? docData.name : "";
    if (!projectName || typeof docData.status !== "string") continue;

    if (dryRun) {
      result.details.push({ orgId, orgName, projectId: moduleDoc.id, projectName, status: "skipped", message: "Dry run - no migrat" });
      result.migrated += 1;
      continue;
    }

    try {
      const newRef = orgRef.collection("projectModule").doc("_").collection("projects").doc(moduleDoc.id);
      const projectAuditRef = auditRef.collection("projectResults").doc(moduleDoc.id);
      const outcome = await migrationDb.runTransaction(async (transaction) => {
        const [sourceSnap, destinationSnap, projectAuditSnap] = await Promise.all([
          transaction.get(moduleDoc.ref),
          transaction.get(newRef),
          transaction.get(projectAuditRef),
        ]);
        if (projectAuditSnap.exists) return "already-recorded" as const;
        if (!sourceSnap.exists) return "source-missing" as const;
        if (destinationSnap.exists) {
          const detail: MigrationResult["details"][number] = {
            orgId,
            orgName,
            projectId: moduleDoc.id,
            projectName,
            status: "skipped",
            message: "Conflicte: el projecte ja existeix al path nou",
          };
          transaction.create(projectAuditRef, {
            action: MIGRATION_KIND,
            target: `organizations/${orgId}/projectModule/${moduleDoc.id}`,
            organizationId: orgId,
            projectId: moduleDoc.id,
            performedBy: context.auth!.uid,
            actorUid: context.auth!.uid,
            reason,
            dryRun: false,
            idempotencyKey,
            requestFingerprint: fingerprint,
            outcome: "destination-exists",
            detail,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });
          return "destination-exists" as const;
        }
        const sourceData = sourceSnap.data?.() ?? docData;
        transaction.create(newRef, {
          ...sourceData,
          _migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          _migratedFrom: `projectModule/${moduleDoc.id}`,
        });
        transaction.delete(moduleDoc.ref);
        const detail: MigrationResult["details"][number] = {
          orgId,
          orgName,
          projectId: moduleDoc.id,
          projectName,
          status: "migrated",
        };
        transaction.create(projectAuditRef, {
          action: MIGRATION_KIND,
          target: `organizations/${orgId}/projectModule/${moduleDoc.id}`,
          destination: `organizations/${orgId}/projectModule/_/projects/${moduleDoc.id}`,
          organizationId: orgId,
          projectId: moduleDoc.id,
          performedBy: context.auth!.uid,
          actorUid: context.auth!.uid,
          reason,
          dryRun: false,
          idempotencyKey,
          requestFingerprint: fingerprint,
          outcome: "migrated",
          detail,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        return "migrated" as const;
      });
      if (outcome !== "migrated") {
        result.details.push({
          orgId,
          orgName,
          projectId: moduleDoc.id,
          projectName,
          status: "skipped",
          message: outcome === "destination-exists"
            ? "Conflicte: el projecte ja existeix al path nou"
            : outcome === "already-recorded"
              ? "Operació ja registrada amb aquesta clau d'idempotència"
              : "El projecte origen ja no existeix; possible reintent concurrent",
        });
        continue;
      }
      result.details.push({ orgId, orgName, projectId: moduleDoc.id, projectName, status: "migrated" });
      result.migrated += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      result.success = false;
      result.errors.push(`Error migrant ${moduleDoc.id}: ${message}`);
      result.details.push({ orgId, orgName, projectId: moduleDoc.id, projectName, status: "error", message });
    }
  }

  const correctProjects = await orgRef.collection("projectModule").doc("_").collection("projects").get();
  await migrationDb.runTransaction(async (transaction) => {
    const auditSnap = await transaction.get(auditRef);
    if (!auditSnap.exists) {
      throw migrationError("failed-precondition", "No existeix el registre d'auditoria de la migració", deps?.errorFactory);
    }
    const audit = auditSnap.data?.() ?? {};
    if (audit.status === "completed" && audit.result && typeof audit.result === "object") return;
    if (audit.activeRunToken !== runToken) {
      throw migrationError("aborted", "El lease de la migració ha canviat de propietari", deps?.errorFactory);
    }
    transaction.set(auditRef, {
      status: "completed",
      result,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      existingProjects: correctProjects.size,
      leaseExpiresAtMs: 0,
    }, { merge: true });
  });
  deps?.logger?.("Migració projectModule finalitzada", {
    actorUid: context.auth.uid,
    orgId,
    dryRun,
    candidates: result.migrated,
    existingProjects: correctProjects.size,
    errors: result.errors.length,
  });
  return result;
}

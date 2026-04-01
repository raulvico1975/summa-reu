#!/usr/bin/env node

/**
 * Cleanup script: deletes meetings older than 90 days.
 *
 * Runs against production Firestore (no emulator).
 * Authentication: uses Application Default Credentials (ADC)
 * or a service account key via GOOGLE_APPLICATION_CREDENTIALS.
 *
 * Usage:
 *   node scripts/cleanup-old-meetings.mjs
 *   DRY_RUN=true node scripts/cleanup-old-meetings.mjs
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const projectId = process.env.FIREBASE_PROJECT_ID || "summa-board";
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
const dryRun = process.env.DRY_RUN === "true";
const RETENTION_DAYS = 90;

// Ensure we're NOT connecting to emulator
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;

const app = getApps()[0] || initializeApp({ projectId, storageBucket });
const db = getFirestore(app);
const storage = getStorage(app);

const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

console.log(`[cleanup] Project: ${projectId}`);
console.log(`[cleanup] Retention: ${RETENTION_DAYS} days`);
console.log(`[cleanup] Cutoff: ${new Date(cutoffMs).toISOString()}`);
console.log(`[cleanup] Dry run: ${dryRun}`);
console.log();

const meetingsSnap = await db
  .collection("meetings")
  .where("createdAt", "<", cutoffMs)
  .get();

console.log(`[cleanup] Found ${meetingsSnap.size} meetings older than ${RETENTION_DAYS} days.`);

let deleted = 0;
let errors = 0;

for (const doc of meetingsSnap.docs) {
  const meetingId = doc.id;
  const data = doc.data();
  const createdAt = new Date(data.createdAt).toISOString();

  console.log(`  - ${meetingId} (created: ${createdAt}, org: ${data.orgId})`);

  if (dryRun) continue;

  try {
    // Delete storage files
    await storage
      .bucket()
      .deleteFiles({ prefix: `meetings/${meetingId}/` })
      .catch(() => {});

    // Delete ingest jobs
    const jobsSnap = await db
      .collection("meeting_ingest_jobs")
      .where("meetingId", "==", meetingId)
      .get();
    if (jobsSnap.size > 0) {
      const batch = db.batch();
      jobsSnap.docs.forEach((jobDoc) => batch.delete(jobDoc.ref));
      await batch.commit();
    }

    // Delete meeting and subcollections (recordings, transcripts, minutes)
    await db.recursiveDelete(doc.ref);
    deleted++;
  } catch (error) {
    console.error(`    ERROR: ${error.message}`);
    errors++;
  }
}

console.log();
console.log(`[cleanup] Done. Deleted: ${deleted}, Errors: ${errors}, Skipped (dry): ${dryRun ? meetingsSnap.size : 0}`);

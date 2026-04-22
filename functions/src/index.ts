import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export { exportProjectExpenses } from "./exports/projectExpenses";
export { exportClosingBundleZip } from "./exports/closingBundleZip";
export { migrateProjectModulePaths } from "./migrations/migrateProjectModulePaths";
export { sendIncidentAlert } from "./alerts/sendIncidentAlert";
export { runWeeklyBackup } from "./backups/runWeeklyBackup";
export { runNightlyHealthCheck } from "./health/runNightlyHealthCheck";
export { runWeeklyProductUpdates } from "./product-updates/runWeeklyProductUpdates";

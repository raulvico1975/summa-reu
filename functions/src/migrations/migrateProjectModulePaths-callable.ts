import * as functions from "firebase-functions/v1";
import { handleMigrateProjectModulePaths } from "./migrateProjectModulePaths";

export const migrateProjectModulePaths = functions
  .region("europe-west1")
  .https.onCall((data, context) => handleMigrateProjectModulePaths(data, context, {
    errorFactory: (code, message) => new functions.https.HttpsError(code, message),
    logger: (message, details) => functions.logger.info(message, details),
  }));

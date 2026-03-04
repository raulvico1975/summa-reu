const defaultProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "summa-board";

export const firebasePublicEnv = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "demo-api-key",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${defaultProjectId}.firebaseapp.com`,
  projectId: defaultProjectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? `${defaultProjectId}.firebasestorage.app`,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:000000000:web:summa-board",
};

export const serverEnv = {
  projectId: process.env.FIREBASE_PROJECT_ID ?? defaultProjectId,
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET ?? `${defaultProjectId}.firebasestorage.app`,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiBaseUrl:
    process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com",
  geminiModel: process.env.GEMINI_MODEL,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "68198321",
  telegramAlertsEnabled: process.env.TELEGRAM_ALERTS_ENABLED ?? "true",
};

export const useEmulators =
  process.env.NEXT_PUBLIC_USE_EMULATORS === "true" || process.env.NODE_ENV !== "production";

export const defaultTimezone = "Europe/Madrid";

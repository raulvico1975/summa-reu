const defaultProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "summa-board";

export const firebasePublicEnv = {
  // Production-safe fallbacks for the default project (public web config, not secret).
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyBcly9Qtk4BrgudbiDAhEhTNCHzNLb6fpM",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${defaultProjectId}.firebaseapp.com`,
  projectId: defaultProjectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? `${defaultProjectId}.firebasestorage.app`,
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:311176921285:web:3905c8fcd66d1ac75cf0ac",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? undefined,
};

export const serverEnv = {
  projectId: process.env.FIREBASE_PROJECT_ID ?? defaultProjectId,
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET ?? `${defaultProjectId}.firebasestorage.app`,
  canonicalHost: process.env.CANONICAL_HOST ?? "summareu.app",
  dailyApiKey: process.env.DAILY_API_KEY,
  dailyApiBaseUrl: process.env.DAILY_API_BASE_URL ?? "https://api.daily.co/v1",
  dailyDomain:
    process.env.DAILY_DOMAIN ??
    process.env.NEXT_PUBLIC_DAILY_DOMAIN ??
    null,
  dailyWebhookBearerToken: process.env.DAILY_WEBHOOK_BEARER_TOKEN ?? null,
  dailyMockMode: process.env.DAILY_MOCK_MODE === "true",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiBaseUrl:
    process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com",
  geminiModel: process.env.GEMINI_MODEL,
  meetingIngestMockMode: process.env.MEETING_INGEST_MOCK_MODE === "true",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "68198321",
  telegramAlertsEnabled: process.env.TELEGRAM_ALERTS_ENABLED ?? "true",
};

export const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

export const defaultTimezone = "Europe/Madrid";

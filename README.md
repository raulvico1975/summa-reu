# SummaBoard

MVP local-first per coordinar votacions tipus Doodle i generar actes de reunió per entitats socials.

## Stack

- Next.js App Router + TypeScript
- Firebase Auth / Firestore / Storage
- Firebase Emulators
- Cloud Functions v2 (skeleton)
- Gemini API (REAL mode opcional)

## Variables d'entorn

Copia `.env.example` a `.env.local` si cal personalitzar.

Variables importants:

- `NEXT_PUBLIC_FIREBASE_PROJECT_ID=summa-board`
- `FIREBASE_PROJECT_ID=summa-board`
- `GEMINI_API_KEY=` (buit = STUB mode)
- `GEMINI_MODEL=` (opcional override)
- `TELEGRAM_BOT_TOKEN=` (obligatori per alertes)
- `TELEGRAM_CHAT_ID=68198321`
- `FORCE_CANONICAL_REDIRECT=false` (posa `true` quan el DNS de `summa-board.app` ja estigui actiu)

## Execució local

1. Bootstrap config Firebase:

```bash
npm run bootstrap:firebase
```

2. Arrencar app + emuladors:

```bash
npm run emu
```

3. Seed de dades demo (en una altra terminal):

```bash
npm run seed
```

4. Smoke test (amb app en marxa):

```bash
npm run test:smoke
```

5. Monitor de login en bucle (opcional):

```bash
npm run monitor:login
```

## Deploy (SSR a Firebase Hosting)

La configuració usa framework backend per Next.js (regió `europe-west1`).

```bash
firebase deploy --only hosting
```

## Credencials demo seed

- Email: `owner@summa.local`
- Password: `123456`

## Secrets en lloc segur (macOS Keychain)

Guarda secrets fora del repo:

```bash
scripts/secrets-keychain.sh set GEMINI_API_KEY "xxxx"
scripts/secrets-keychain.sh set TELEGRAM_BOT_TOKEN "xxxx"
scripts/secrets-keychain.sh set TELEGRAM_CHAT_ID "68198321"
scripts/secrets-keychain.sh set FIREBASE_CLIENT_EMAIL "service-account@project.iam.gserviceaccount.com"
scripts/secrets-keychain.sh set FIREBASE_PRIVATE_KEY "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
scripts/secrets-keychain.sh set FIREBASE_PRIVATE_KEY_ID "xxxx"
```

Genera `.env.local` des de Keychain:

```bash
scripts/secrets-keychain.sh write-env
```

Consultar un secret:

```bash
scripts/secrets-keychain.sh get GEMINI_API_KEY
```

## Rutes

Públiques:

- `/p/[slug]`
- `/p/[slug]/results`

Owner:

- `/login`
- `/signup`
- `/dashboard`
- `/polls/new`
- `/polls/[pollId]`
- `/meetings/[meetingId]`

## Notes MVP

- Les escriptures públiques de vots entren només via `/api/public/vote`.
- El token de votant només es guarda raw a `localStorage`; al servidor només hash.
- Les votacions admeten un màxim de 20 franges.
- Pipeline premium:
  - Sense `GEMINI_API_KEY`: STUB
  - Amb `GEMINI_API_KEY`: intent REAL (Gemini); fallback STUB si falla.
- El processament de gravacions es posa en cua (response `202`) i la pantalla de reunió s'actualitza automàticament.
- Monitorització d'errors:
  - `instrumentation.ts` captura errors de servidor no controlats.
  - `/api/public/error-report` rep errors de navegador.
  - Les alertes s'envien a Telegram amb missatge humà que comença per `Summa-Board`.

## Proves de producció recomanades

1. Validar permisos Firebase (client públic sense escriptura):

```bash
npm run test:permissions
```

2. Validar canal Telegram:

```bash
npm run test:telegram
```

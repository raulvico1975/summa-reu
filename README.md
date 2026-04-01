# Summa Reu

Plataforma local-first per coordinar votacions i generar actes de reunio per a entitats socials.

**Produccio:** [summareu.app](https://summareu.app)

## Que fa

- Coordinacio de reunions amb enquestes de disponibilitat (estil Doodle)
- Videoconferencies integrades amb gravacio
- Generacio automatica d'actes amb IA (Gemini)
- Subscripcions i onboarding amb Stripe
- Alertes operatives via Telegram

## Stack

| Capa | Tecnologia |
|------|------------|
| Frontend | Next.js (App Router) + TypeScript |
| Auth | Firebase Auth |
| Dades | Firestore |
| Fitxers | Firebase Storage |
| Video | Daily.co |
| IA | Google Gemini (opcional, mode STUB si no hi ha clau) |
| Pagaments | Stripe |
| Hosting | Firebase App Hosting |

## Execucio local

```bash
# 1. Configuracio Firebase
npm run bootstrap:firebase

# 2. Arrancar app + emuladors
npm run emu

# 3. Seed de dades demo (en una altra terminal)
npm run seed

# 4. Smoke test
npm run test:smoke
```

Credencials demo: `owner@summa.local` / `123456`

## Variables d'entorn

Copia `.env.example` a `.env.local` i omple les variables Firebase i opcionals (Gemini, Stripe, Telegram).

## CI/CD

- **CI** (`.github/workflows/ci.yml`): lint + smoke amb emuladors. Obligatori per PR i `main`.
- **Deploy**: automatitzat via Firebase App Hosting quan entra codi a `main`.
- **Mirror de seguretat**: sync horari unidireccional a [summa-reu-mirror](https://github.com/raulvico1975/summa-reu-mirror).

## Estructura

```
src/
  app/          Rutes Next.js (publiques i autenticades)
  components/   Components UI i de domini
  lib/          Logica de negoci
  hooks/        Hooks de React
functions/      Firebase Functions (exports, backups, alertes)
scripts/        Utilitats de QA, deploy i manteniment
tests/          Proves i checklist manual
docs/           Documentacio operativa i contractes
```

## Rutes principals

| Ruta | Tipus |
|------|-------|
| `/p/[slug]` | Publica — enquesta de disponibilitat |
| `/p/[slug]/results` | Publica — resultats |
| `/login`, `/signup` | Auth |
| `/dashboard` | Dashboard principal |
| `/polls/new` | Crear enquesta |
| `/owner/meetings/[id]` | Detall de reunio |
| `/billing` | Gestio de subscripcio |

# Summa Social

**Gestió financera i fiscal per a entitats sense ànim de lucre**

## Per què existeix Summa Social

Les petites i mitjanes entitats espanyoles gestionen les seves finances amb fulls de càlcul. Això provoca errors humans en la categorització, dificultat per generar informes fiscals obligatoris, conciliació bancària manual i propensa a errors, i pèrdua de temps en tasques repetitives.

Summa Social substitueix els fulls de càlcul per una eina centralitzada, dissenyada específicament per a les necessitats del sector social: conciliació bancària real, control de saldos, classificació de moviments i preparació fiscal neta per a gestories.

## Públic objectiu

Gestors, administradors i tresorers d'entitats sense ànim de lucre que necessiten una visió clara de les seves finances per a la presa de decisions, la justificació a finançadors i el compliment de les obligacions fiscals.

---

## Funcionalitats principals

### Gestió de moviments bancaris

- **Importació d'extractes** en formats CSV i Excel amb detecció automàtica de columnes
- **Multicomptes bancaris** amb filtre i traçabilitat per compte
- **Prevenció de duplicats** automàtica en cada importació
- **Adjunció de documents** (factures, comprovants) amb drag & drop
- **Selecció múltiple** per aplicar accions en bloc (assignar/treure categoria)

### Conciliació intel·ligent

- **Auto-assignació de contactes** per nom, DNI o IBAN
- **Categorització amb IA** (Gemini) amb suggerències que sempre requereixen confirmació
- **Regles deterministes** per patrons de text (loteria, voluntariat)
- **Categories per defecte** per contacte

### Divisor de remeses

- **Remeses d'ingressos (quotes de socis):** Desglossa un ingrés agrupat en donacions individuals amb matching per DNI, IBAN o nom
- **Remeses de devolucions:** Importa fitxers del banc per identificar quotes retornades
- **Remeses de pagaments (OUT):** Divideix despeses agrupades en pagaments individuals amb generació de fitxer SEPA pain.001

### Gestió de contactes

- **Donants:** Particulars i empreses amb estat actiu/baixa, quota mensual, IBAN
- **Proveïdors:** Amb categoria per defecte i dades fiscals
- **Treballadors:** Per a nòmines i pagaments recurrents
- **Importació massiva** des d'Excel amb plantilla oficial
- **Exportació a Excel** de la base de donants

### Fiscalitat i informes

- **Model 182:** Exportació Excel per a gestoria amb càlcul automàtic de donacions netes (donacions - devolucions), recurrència i historial de 3 anys
- **Model 347:** Operacions amb tercers superiors a 3.005,06€
- **Certificats de donació:** PDF individuals, anuals o massius amb logo i firma digitalitzada
- **Consolidació automàtica** d'imports per donant amb devolucions aplicades

### Dashboard

- **Bloc "Diners":** Ingressos, despeses operatives, transferències a terreny, saldo operatiu
- **Bloc "Qui ens sosté":** Quotes de socis, donacions puntuals, socis actius, donants actius
- **Obligacions fiscals:** Alertes amb dates límit (Model 182: 31 gener, Model 347: 28 febrer)
- **Filtres temporals:** Any, trimestre, mes, personalitzat

### Projectes i eixos d'actuació

- Assignació de moviments a projectes/finançadors
- Balanç per projecte: finançat, enviat a terreny, despeses, saldo pendent

### Multi-organització i seguretat

- Suport per múltiples organitzacions amb dades aïllades
- Sistema de rols: SuperAdmin, Admin, User, Viewer
- Sessió amb tancament automàtic per inactivitat (30 minuts)
- Multi-idioma: Català, Espanyol, Francès, Portuguès

---

## Stack tecnològic

| Component | Tecnologia |
|-----------|------------|
| Frontend | Next.js 15 (App Router) + React 18 |
| Llenguatge | TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| Base de dades | Firebase Firestore |
| Autenticació | Firebase Auth |
| Emmagatzematge | Firebase Storage |
| IA | Genkit + Google Gemini |
| Excel/CSV | SheetJS |
| PDF | jsPDF |

---

## Documentació

- [Índex de documentació](docs/README.md) — Mapa i criteri d'ordre de `/docs`
- [Manual de referència complet](docs/SUMMA-SOCIAL-REFERENCIA-COMPLETA.md) — Document mestre del projecte
- [Catàleg de funcionalitats](docs/CATALEG-FUNCIONALITATS.md) — Referència ràpida
- [Manual d'usuari](docs/manual-usuari-summa-social.md) — Per a usuaris finals
- [Changelog](docs/CHANGELOG.md) — Historial de canvis

## Blog públic

- Variables d'entorn requerides: `BLOG_ORG_ID`, `BLOG_PUBLISH_SECRET`
- Auth: `Authorization: Bearer <secret>`
- Endpoint upload portada: `POST /api/blog/upload-cover`
- Endpoint publicació: `POST /api/blog/publish`
- Upload portada: body JSON amb `slug`, `imageBase64`, `mimeType`; retorna `coverImageUrl`
- Payload mínim: `title`, `slug`, `seoTitle`, `metaDescription`, `excerpt`, `contentHtml`, `tags`, `category`, `publishedAt` i `coverImageUrl` opcional
- Errors esperats: `401` sense auth vàlida, `400` per payload invàlid, `409` per `slug` duplicat
- Contracte extern: `docs/contracts/blog-publish-cover-image.md`

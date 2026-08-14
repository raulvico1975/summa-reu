# Traçabilitat comercial dels plans 49/79/119

Data de revisió: 14 d'agost de 2026

## Contracte públic

- Identificadors públics únics: `control`, `management`, `complete`.
- Noms i preus: Control 49 €/mes, Gestió 79 €/mes i Complet 119 €/mes.
- Catàleg tècnic de referència: `PLAN_ENTITLEMENTS_CATALOG`, versió 3.
- El pla defineix el màxim disponible. La configuració operativa i els permisos d'usuari només el poden restringir.
- Les dades històriques no s'eliminen en un downgrade. Els catàlegs mantenen lectura històrica per a documents de moviments, documents pendents i projectes.

## Matriu claim → superfície → entitlement

| Claim públic | Pla mínim | Superfície funcional | Entitlement o control | Formulació pública |
|---|---|---|---|---|
| Importació i revisió d'extractes bancaris | Control | Importador i taula de moviments | Funcionalitat comuna; permisos operatius | «Importació i revisió», mai conciliació automàtica general |
| Alta i edició manual de moviments | Control | Moviments | Funcionalitat comuna; permisos operatius | «Moviments manuals» |
| Socis, donants, quotes i remeses SEPA | Control | Contactes, donants i remeses | Funcionalitat comuna; permisos operatius | «Quotes i remeses SEPA» |
| Gestió manual de devolucions | Control | Moviments i devolucions | Funcionalitat comuna; permisos operatius | «Gestió manual», mai devolucions automàtiques o massives |
| Certificats i preparació del Model 182 | Control | Donants i informes fiscals | Funcionalitat comuna; permisos fiscals | «Preparació subjecta a revisió»; no prometre presentació a l'AEAT |
| Pujar i vincular documents als moviments | Gestió | Documents de moviments | `transactionDocuments.mutate` | Diferència principal entre Control i Gestió |
| Control de moviments sense document | Gestió | Filtres i estat documental dels moviments | Associat a l'accés documental de Gestió | «Control dels moviments sense document» |
| Categorització assistida amb IA | Gestió | Importador i categorització de moviments | `aiCategorization.execute`; API server-side | «Propostes» o «assistida»; la persona revisa |
| Preparació i exportació del Model 347 | Gestió | Informe de proveïdors | `model347.read`, `model347.export`; API server-side | «Preparació subjecta a revisió» |
| Safata de documents previs o pendents | Complet | Documents pendents | `pendingDocuments.mutate`; lectura històrica separada | No confondre amb el filtre de moviments sense document |
| Propostes de conciliació documental | Complet | Matching de documents pendents | `pendingDocuments.match` | Sempre «propostes» o «conciliació assistida»; mai autoassignació general |
| OCR i extracció assistida | Complet | Documents pendents, PDF i tiquets | `pendingDocuments.ocr`; APIs server-side d'extracció | «Extracció assistida de dades» |
| Paquet de tancament | Complet | Informes i export ZIP | `closingBundle.export`; API server-side | «Paquet de tancament amb moviments i documents» |
| Projectes i imputació de despeses | Complet | Mòdul de projectes | `projects.mutate` | No presentar-ho com a comptabilitat formal |
| Partides i pressupostos | Complet | Pressupost de projectes | `projectBudgets.mutate` | «Projectes, partides i pressupostos» |
| Multidivisa en projectes | Complet | Despeses i transferències de projectes | `multicurrency.mutate` | Limitar sempre l'abast als projectes |
| XLSX estructurat per preparar justificacions | Complet | Export de justificació | `grantJustification.export`; API server-side | «Preparar» i «subjecte a revisió»; mai justificació automàtica |

## Claims exclosos dels plans

- Stripe, cobraments online o passarel·les de pagament.
- Pujada il·limitada de documents.
- Devolucions automàtiques, automatitzades o massives.
- Conciliació o assignació automàtica general.
- Multidivisa general de l'organització.
- Justificació automàtica o «amb un clic».
- Presentació automàtica dels Models 182 o 347.

Stripe continua documentat com a operativa existent allà on correspon, però no és un benefici diferencial ni un entitlement comercial dels plans públics.

## Downgrade

- `transactionDocuments.readHistorical`, `pendingDocuments.readHistorical` i `projects.readHistorical` són disponibles als tres plans.
- En baixar de pla es conserven la consulta i la descàrrega històriques quan corresponen.
- Les mutacions, exports i processos reservats al pla superior deixen d'estar disponibles.
- La web no ha de prometre eliminació, migració o transformació automàtica de dades en el canvi de pla.

## Superfícies que han de quedar sincronitzades

- `src/i18n/public.ts`: copy CA/ES/FR/PT, plans, comparativa, FAQ i missatges del formulari.
- `src/app/public/[lang]/preus/page.tsx`: cards, taula, FAQ visible i `FAQPage` JSON-LD.
- `src/app/public/[lang]/page.tsx`: resum de plans de la home.
- `src/app/public/[lang]/funcionalitats/page.tsx`: formulacions assistides i fiscalitat subjecta a revisió.
- `docs/FAQ_SUMMA_SOCIAL.md`: resposta comercial i downgrade.
- `docs/SUMMA-SOCIAL-REFERENCIA-COMPLETA.md`: model comercial i arquitectura d'entitlements.

No s'ha d'afegir `Product`/`Offer` JSON-LD mentre no hi hagi un contracte estructurat que representi correctament periodicitat, disponibilitat i condicions d'alta. El `FAQPage` JSON-LD només pot reproduir preguntes i respostes visibles a la pàgina.

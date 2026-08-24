# Auditoria nocturna integral — Summa Social
**Data:** 2026-08-23 (nit) · **Mode:** només lectura, cap modificació de codi ni dades · **Equip:** @dev-senior-summa + 2 auditors subagent

---

## 1. Auditoria fiscal de devolucions legacy (Error 1 P2)

Executat el detector `scripts/fiscal/audit-legacy-returns.ts` contra les dues organitzacions demanades:

| Organització | orgId | Devolucions sense enllaç | Donacions retornades sense enllaç | Candidats |
|---|---|---:|---:|---:|
| Baruma | `PrNPBg7YFnk16f9gXdXw` | 0 | 0 | **0 — net** |
| Fundació Flores de Kiskeya | `SkQjWvCRDJhSf1OeJAw9` | 0 | 0 | **0 — net** |

Cap parella donació-retornada + devolució bancària sense enllaç detectable. Les dades d'ambdues orgs estan netes respecte l'Error 1. No s'ha tocat cap dada.

---

## 2. Auditoria de seguretat

### 🔴 ALTA (3)
1. **`firestore.rules:465-472` — crear transaccions ignora els overrides de permisos.** El `create` només mira el rol (`admin`/`user`), mentre l'`update` sí que aplica capabilities i `memberPermissionDenied`. Un usuari amb `deny: ['moviments.editar']` no pot editar però **sí crear** moviments → pot desquadrar saldos.
2. **`firestore.rules:503,601,610,619,840` — mateix patró a donations, donors, suppliers i remittances**, on a més un rol `user` pot fer **delete** de remeses (documents financers).
3. **`src/app/api/blog/publish/handler.ts:56-58` (+ upload-cover/update/unpublish) — secret amb fallback hardcoded** `'local-blog-publish-secret'` si falta la variable d'entorn en mode local. Si això arriba a prod, qualsevol pot publicar al blog. Els altres endpoints equivalents fallen correctament.

### 🟡 MITJANA (4)
4. `audit_logs`: qualsevol membre pot crear entrades arbitràries → traça d'auditoria forjable.
5. Doble règim de permisos entre `remittances` (sense entitlement gating) i `prebankRemittances` (amb).
6. `storage.rules:318-324`: XML SEPA pujable sense gating d'entitlement.
7. Divergència de rols: les API accepten `superadmin` com a admin; les Firestore rules no.

### 🟢 BAIXA (3)
8. Lectura pública del col·lecció `slugs` (probablement intencional).
9. Membres poden crear incidents de sistema (soroll al panell admin).
10. Checks MIME de Storage depenen del contentType declarat pel client (limitació inherent; mitigable validant bytes al backend).

### ✅ Cobert i correcte
Sense cap `allow all`; multi-tenant sòlid (tot passa per `isMemberOf(orgId)`); subscription/registres fiscals backend-owned (write:false); entitlements fail-closed; storage amb deny-by-default doble, MIME+mida a tot arreu; cobertura de guards a totes les rutes fiscal/remittances/admin molt bona.

---

## 3. Dependències (npm audit --omit=dev)

**71 vulnerabilitats (5 crítiques, 23 altes).** Crítiques: `fast-xml-parser`, `handlebars`, `jspdf`, `protobufjs`, `websocket-driver`. Altes directes rellevants: `next`, `express`, `lodash`, `sharp` (CVE libvips), `nanoid`, `postcss`, `undici`.
**Recomanació:** sessió dedicada de `npm audit fix` controlada amb suite completa després — no fer-ho de nit ni automàtic (`--force` pot trencar).

---

## 4. Documentació i bot d'ajuda

### 🟡 MITJANA (3)
1. **Ajuda per una pantalla inexistent:** `src/help/{ca,es,fr}/help-content.ts` té entrada per `/dashboard/ejes-de-actuacion`, ruta que no existeix a l'app.
2. **Manual FR molt incomplet:** 17 anchors (~11 KB) vs 274 del CA (~89 KB), però conté l'àncrea sentinella `11-resolucio-de-problemes`, així que el fallback automàtic a CA **no s'activa** → l'usuari francòfon rep un manual esquelet.
3. **2 enllaços trencats al bot FR:** `manual#1-primers-passos` i `manual#8-projectes-eixos-dactuacio` no existeixen al manual FR.

### 🟢 BAIXA
4. Entrada `/dashboard/projectes` d'ajuda només existeix en ca (placeholder); es/fr no en tenen. `HelpRouteKey` acaba en `| string` i TypeScript no ho detecta.
5. Els 4 docs de deploy descriuen el mateix protocol coherent i tots els scripts npm referenciats existeixen; vigilar dates (~4 mesos).

### ✅ Correcte
Validadors oficials (`i18n:check`, `i18n:validate-help`, `help:validate-topics`) passen nets per CA; contingut fiscal sincronitzat ca/es/fr/pt (294 claus help.*); cap text que informi malament sobre diners/fiscals.

---

## 5. Verificació post-deploy (tancament del cicle anterior)
- Revisió activa App Hosting: `studio-build-2026-08-23-002` (ready), endpoint HTTP 200.
- Reproductors fiscals re-executats sobre prod-build: ✅ passen.
- Incidència `DEPLOY-INCIDENTS.md` 2026-08-23 marcada RESOLT.

---

## Pla d'acció recomanat (per decidir demà)
1. **P1 — firestore.rules:** aplicar capabilities+denied als `create` financers (transaccions, donations, donors, suppliers) i treure delete de remeses al rol user. Risc de canvi de comportament: provar amb l'emulador de rules.
2. **P1 — blog publish:** eliminar el fallback hardcoded del secret (fallar si falta, com fan els altres endpoints).
3. **P2 — npm audit fix** controlat per famílies (next, sharp/libvips primer) amb suite completa.
4. **P3 — Bot/manual FR:** completar manual francès o activar fallback per mida; esborrar entrada `/dashboard/ejes-de-actuacion`; afegir entrada `/dashboard/projectes` a es/fr.
5. **P3 — audit_logs:** restringir create a backend-only o validar estructura.

*Cap fitxer modificat durant aquesta auditoria.*

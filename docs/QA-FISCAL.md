# Verificació Fiscal Pre-Deploy

> **Obligatori** abans de qualsevol push a prod (via deploy des de main) que toqui:
> Moviments, Remeses, Devolucions, Donants, Certificats, Imports, Permisos

---

## 1. Propòsit

Aquest checklist assegura que els fluxos fiscals crítics no tenen regressions abans d'anar a producció.

**Quan executar-lo:**
- Abans de qualsevol push a prod (via `npm run publica`) que toqui codi fiscal
- Després de canvis a `ReturnImporter`, `RemittanceProcessor`, `fiscal-*.ts`, `certificate-*.ts`
- Abans de deploy que afecti moviments o donants

---

## 2. Checklist de verificació (PASS/FAIL)

### Registre manual 2026-04-05 — Amplada de llistats de donants, remeses i fiscalitat

**Context:**
Ajust de layout per aprofitar millor l'amplada disponible en llistats sensibles de `Donants`, pas de configuració/selecció de `Remeses SEPA`, `Model 182` i `Certificats`. El canvi fixa millor les columnes desktop, amplia l'espai útil en pantalles grans i elimina contenidors massa estrets sense tocar càlculs, persistència ni criteris fiscals.

**Comprovacions aplicades:**
1. Revisió visual del llistat desktop de `/{org}/dashboard/donants`, comprovant que les columnes `Nom`, `NIF`, tipus, modalitat i import aprofiten l'amplada i que els noms llargs es trunquen sense desquadrar la fila.
2. Revisió visual del pas `Configuració` i del pas `Selecció` de `/{org}/dashboard/donants/remeses-cobrament`, comprovant doble columna en desktop, cercador més ample i taules principals/exclosos sense aparença encaixonada.
3. Revisió visual dels llistats desktop de `/{org}/dashboard/informes` per `Model 182` i `Certificats`, validant repartiment de columnes, imports alineats i absència d'overflow horitzontal crític.
4. Verificació tècnica amb `scripts/verify-local.sh` en verd, incloent `npm run build` correcte sobre el commit candidat.

**Resultat:**
- [x] El canvi és només de layout/taula i no altera imports, totals, remeses, certificats ni regles fiscals.
- [x] Els llistats sensibles aprofiten més bé l'amplada desktop i mantenen truncat controlat en camps llargs.
- [x] Remeses SEPA mostra configuració i selecció amb més espai útil, coherent amb la resta de llistats del dashboard.
- [x] La guardrail fiscal queda coberta amb evidència manual del flux afectat i build de producció correcte.

### Registre manual 2026-04-03 — Modals de remeses, Stripe i resum pre-importació

**Context:**
Ajust de layout i llegibilitat en fluxos sensibles de remeses i importació bancària: `Desglosar importe`, `Configuración del mapeo al dividir remesa`, `Detalle de la remesa`, `Imputar Stripe`, `Detalle imputación Stripe` i `Resum pre-importació` de l'extracte bancari. El canvi amplia modals, redistribueix blocs en desktop, reforça el responsive en pantalles estretes i fa més visible la previsualització sense tocar càlculs, imports ni persistència.

**Comprovacions aplicades:**
1. Revisió visual a la demo `work` de `dashboard/movimientos`, validant les modals de Stripe i remeses en desktop i comprovant absència d'overflow horitzontal crític.
2. Revisió manual del pas `Configuración del mapeo al dividir remesa` per confirmar doble columna en desktop (`Configuració bàsica` + `Mapeo de campos`) i previsualització més visible a primer cop d'ull.
3. Revisió manual del `Resum pre-importació` d'extracte bancari per validar resum superior, preview en targetes a pantalles petites i taula més llegible a desktop.
4. Verificació tècnica amb `scripts/verify-local.sh` i `scripts/verify-ci.sh` en verd sobre el commit final.
5. Verificació addicional amb `npm run typecheck` i demo local operativa a `http://127.0.0.1:9002/demo/dashboard/movimientos`.

**Resultat:**
- [x] El canvi és d'UX/layout i no altera càlculs fiscals, imports, remeses processades ni lògica de conciliació.
- [x] Les modals sensibles guanyen amplada útil i redueixen la dependència de scroll horitzontal.
- [x] La previsualització de remesa i d'import bancari és més visible i llegible en desktop i en pantalles estretes.
- [x] La guardrail fiscal queda coberta amb evidència manual del flux afectat i validació tècnica completa.

### Registre manual 2026-04-02 — Summa IA assignant categories

**Context:**
Millora visual del flux massiu de categorització a `Moviments`: nova modal de progrés centrada, amb protagonisme per `Summa IA`, estat de procés més clar i pista visual discreta de categories en curs. No canvia el motor de classificació, ni els criteris fiscals, ni el persistit de categories.

**Comprovacions aplicades:**
1. Revisió manual al demo `movimientos` amb moviments pendents reals per validar que el botó `Suggerir categories` activa la nova modal i que el procés es pot iniciar sense errors.
2. Verificació visual del contingut de la modal: titular de `Summa IA`, barra de progrés, estat actual i pista inferior de categories sense overflow en desktop.
3. Revisió del hook `useTransactionCategorization` per confirmar que només exposa estat de progrés addicional i no altera la lògica de selecció, guardat o fallback a `Revisar`.
4. Verificació tècnica amb `npm run typecheck`, `npm run build`, `npm run acabat` i `npm run integra`.

**Resultat:**
- [x] El canvi és d'UX/visibilitat del procés i no altera càlculs fiscals ni assignacions comptables.
- [x] La categorització continua aplicant les mateixes regles i persistint les mateixes categories que abans.
- [x] La modal nova apareix només quan hi ha moviments pendents i no interfereix amb el flux de moviments ja classificats.
- [x] La guardrail fiscal queda coberta amb evidència manual i validació tècnica del flux afectat.

### Registre manual 2026-04-02 — Mapping d'importacio bancaria i compactacio visual de moviments

**Context:**
Ajust visual del llistat de Moviments i de la modal `Configuración del mapeo` de l'importador d'extractes bancaris. El canvi compacta badges i files, eixampla la modal de mapping en desktop, redistribueix `Mapeo de campos` vs `Previsualización`, i fa la previsualitzacio mes llegible sense alterar el processament ni els calculs.

**Comprovacions aplicades:**
1. Revisio visual a `demo/dashboard/movimientos` per validar que `DEF`, `COM`, `Stripe` i remeses processades no incrementen l'alçada de les files de manera inconsistent.
2. Revisio visual del contacte i de la icona de document a la taula de moviments per comprovar que no hi ha solapaments ni regressions de lectura.
3. Revisio manual del flux `Importar extracte bancari -> seleccionar compte -> Configuración del mapeo` en desktop, verificant amplada real de la modal, panell esquerre mes contingut i previsualitzacio amb mes espai util.
4. Verificacio de la previsualitzacio del mapping: dates i imports compactes, concepte truncat amb el text complet al `hover`, i scroll horitzontal disponible des de la part superior.
5. Verificacio tecnica amb `npm run typecheck -- --pretty false` i checks automatics del pre-commit (`npm test`, `docs:check`, validacions d'i18n).

**Resultat:**
- [x] El canvi és UI-only i no altera importacions, remeses, devolucions, saldos ni càlculs fiscals.
- [x] La modal de mapping en desktop guanya espai real de previsualitzacio i redueix la necessitat de scroll horitzontal.
- [x] La taula de moviments manté una alçada de fila mes homogènia i una lectura mes neta.
- [x] La guardrail fiscal queda coberta amb evidència manual del flux afectat.

### Registre manual 2026-04-02 — Modal de donants desktop + i18n local

**Context:**
Millora visual de la modal de creacio/edicio de donants per desktop, amb amplada responsive mes generosa, reagrupacio en seccions amples i neteja local d'i18n per evitar barreja de textos en catala dins la modal quan l'idioma actiu es `es` o `fr`.

**Comprovacions aplicades:**
1. Revisio visual de la modal de nou donant en desktop, comprovant amplada, camps visibles i absencia d'overflow horitzontal.
2. Revisio visual de la mateixa modal en mobil, mantenint una sola columna i sense regressio de scroll.
3. Revisio manual de la modal en `ca`, `es`, `fr` i `pt` per validar títols, ajudes i placeholders nous.
4. Verificacio tecnica amb `npm run typecheck`, `npm run i18n:check` i `npm run i18n:check-tr-keys`.
5. Verificacio predeploy amb `scripts/verify-local.sh` i `scripts/verify-ci.sh` executats amb les variables publiques de build carregades des d'`apphosting.yaml`.

**Resultat:**
- [x] En desktop, la modal aprofita millor l'espai i els camps principals ja no queden tallats ni massa estrets.
- [x] En mobil, el layout continua en una sola columna i sense overflow horitzontal.
- [x] Els textos nous de la modal no mostren claus crues ni fallback inline en catala quan l'idioma actiu es `es` o `fr`.
- [x] El canvi es limita a layout/i18n local de la modal i no altera guardat, model de dades ni calculs fiscals.

### Registre manual 2026-03-30 — Moviments badges suaus

**Context:**
Retoc visual del llistat de Moviments per reduir soroll a desktop i mòbil, amb badges curts `dev.` i `com.` i reforç d'i18n perquè aquestes etiquetes surtin de claus traduïbles en lloc de literals incrustats.

**Comprovacions aplicades:**
1. Revisió visual de la taula de Moviments a desktop: capçalera més lleugera, més espai vertical per fila i badges suaus per devolucions/comissions.
2. Revisió visual de la llista apilada de Moviments a mòbil: targetes amb més aire i badges curts coherents.
3. Verificació d'i18n: claus noves `movements.table.returnBadgeShort` i `movements.table.commissionBadgeShort` presents a `ca`, `es`, `fr` i `pt`.
4. Verificació tècnica amb `npm run lint`, `npm run check`, `npm run i18n:check` i `npm run i18n:check-tr-keys`.

**Resultat:**
- [x] Els badges de devolució i comissió es mostren amb estil discret i amb etiquetes curtes consistents.
- [x] Desktop i mòbil mantenen el color semàntic existent sense incrementar el pes visual.
- [x] El canvi és només de presentació/i18n; no altera imports, saldos ni càlculs fiscals.

### Registre manual 2026-03-30

**Context:**
Correcció d'i18n al drawer/fitxa del donant perquè la modal en castellà no mostri literals en català a les targetes de resum ni als textos auxiliars del certificat.

**Comprovacions aplicades:**
1. Revisió de la modal de dades del donant en `es` a la targeta d'any actual.
2. Revisió de la targeta d'import net certificable en `es`.
3. Verificació de claus d'i18n noves per `ca`, `es` i `fr` al flux `donorDetail`.
4. Verificació tècnica amb `npm run typecheck` i `npm run i18n:check-ts`.

**Resultat:**
- [x] En `es`, el resum mostra `Año anterior` i ja no mostra `Any anterior`.
- [x] Els textos auxiliars del certificat anual queden resolts via claus d'i18n i no per literals incrustats.
- [x] No s'han alterat imports ni càlculs del resum fiscal; el canvi és de copy/i18n del flux existent.

### Registre manual 2026-03-29

**Context:**
Ronda de verificació visual i funcional prèvia a deploy per canvis en modals fiscals, imports i fitxes relacionades.

**Comprovacions aplicades:**
1. Model 182: modal de donants exclosos revisat en `ca` i `es`, desktop i mòbil.
2. Certificats: previsualització de certificat oberta i validada en demo.
3. Import bancari: selector de compte i pas de mapeig revisats en mòbil, amb CTA visibles i sense overflow horitzontal rellevant.
4. Fitxa de donant / drawer: revisió visual de dades, resums i CTA en mòbil.
5. Model 347 i conciliació: revisió de layout, scroll intern i visibilitat de botons sobre el codi actualitzat.
6. Split detail / devolucions / importadors: revisió estructural de modal i validació tècnica amb `npm run typecheck` i `npm run build`.

**Resultat:**
- [x] Els modals crítics mostren el text complet i els CTA queden visibles.
- [x] El scroll vertical queda contingut dins del modal.
- [x] No s'ha reproduït truncament horitzontal crític als casos revisats.
- [x] Build de producció correcta sobre `main` net abans del deploy.

### VF-1 Remesa IN amb IBAN ambigu

**Passos:**
1. Obrir `/{org}/dashboard/movimientos`
2. Localitzar una remesa pare (IN) amb filles pendents
3. Dividir remesa → apareix modal de resolució
4. Seleccionar cas "2 donants amb aquest IBAN"
5. Resoldre assignant a un dels donants
6. Processar

**Expected:**
- [ ] No bloqueig durant el flux
- [ ] Comptadors del pare a 0 després de processar
- [ ] Filles creades amb `contactId` assignat correctament
- [ ] Filles visibles a la fitxa del donant

---

### VF-2 Remesa IN amb IBAN no trobat

**Passos:**
1. Obrir remesa pare amb IBAN desconegut
2. Verificar que es veu l'IBAN complet (no truncat)
3. Copiar IBAN amb botó de còpia
4. Opció A: Assignar a suggerit per DNI
5. Opció B: Deixar pendent

**Expected:**
- [ ] No bloqueja el flux
- [ ] IBAN complet visible i copiable
- [ ] Pendents visibles al llistat amb indicador clar
- [ ] Cap contacte duplicat creat automàticament

---

### VF-3 Devolucions conjuntes (ReturnImporter contextual)

**Passos:**
1. Obrir remesa pare amb devolucions associades
2. Clicar "Importar devolucions" (des del context del pare)
3. Importar fitxer XML/CSV de devolucions
4. Seleccionar opció `FORCE_RECREATE` si s'ofereix
5. Processar

**Expected:**
- [ ] Filles creades amb `transactionType = 'return'`
- [ ] Import negatiu (`amount < 0`)
- [ ] `contactId` present a cada filla
- [ ] Devolucions visibles a la fitxa del donant
- [ ] Net del donant actualitzat correctament

---

### VF-4 Fitxa donant (query per contactId) + net correcte

**Passos:**
1. Obrir fitxa d'un donant amb donacions i devolucions
2. Verificar secció de moviments fiscals

**Expected:**
- [ ] Net = Donacions − Devolucions
- [ ] Càlcul no depèn de l'estat del donant (actiu/inactiu)
- [ ] Tots els moviments amb `contactId` apareixen
- [ ] Ordenació cronològica correcta

---

### VF-5 Certificat 2025

**Passos:**
1. Generar certificat de donació per a un donant amb moviments
2. Verificar import total al certificat

**Expected:**
- [ ] Import del certificat = net de la fitxa donant
- [ ] Usa el mateix motor de càlcul que la fitxa
- [ ] Format fiscal correcte (import en lletres, NIF, etc.)

---

### VF-5b Sense doble còmput (return + donationStatus=returned)

**Context:**
Quan una devolució negativa està vinculada a la donació original, la fitxa/certificat no han de comptar dues devolucions pel mateix cas.

**Passos:**
1. Obrir fitxa d'un donant amb cas vinculat (`return` negatiu + donació `returned`) el mateix any.
2. Revisar targeta "Devolucions" i la llista de "Últimes devolucions".
3. Generar certificat anual del mateix any.

**Expected:**
- [ ] El cas vinculat compta una sola vegada com a devolució efectiva.
- [ ] `Total devuelto` no suma duplicat del mateix cas.
- [ ] El net del certificat no aplica doble resta pel mateix retorn.

---

### VF-6 Undo de processament

**Passos:**
1. Localitzar remesa pare processada
2. Clicar "Desfer" (Undo)
3. Confirmar al diàleg
4. Tornar a processar la remesa

**Expected:**
- [ ] Filles passen a estat arxivat (soft-delete)
- [ ] Pare torna a estat inicial (comptadors reset)
- [ ] Reprocessament genera filles noves correctament
- [ ] No hi ha filles duplicades

---

### VF-7 Locks multiusuari

**Passos:**
1. Obrir dues pestanyes/navegadors amb el mateix usuari o usuaris diferents
2. A pestanya A: iniciar processament d'una remesa
3. A pestanya B: intentar processar o desfer la mateixa remesa

**Expected:**
- [ ] Una pestanya guanya (processa correctament)
- [ ] L'altra rep missatge "Operació bloquejada per un altre usuari"
- [ ] No hi ha corrupció de dades
- [ ] El lock s'allibera després de completar/cancel·lar

---

### VF-8 Recuperació via Desfer → Processar

**Context:**
No existeix "Reparar" com a operació separada. El flux de recuperació és sempre: Desfer → Processar.

**Passos:**
1. Localitzar remesa pare processada amb inconsistència (o simular-ne una)
2. Obrir "Veure detall" de la remesa
3. Verificar que apareix banner vermell "Inconsistència detectada"
4. Llegir missatge: "Per recuperar aquesta remesa, desfés-la primer i torna-la a processar."
5. Tancar modal i clicar "Desfer remesa" (Undo)
6. Tornar a obrir el splitter i pujar el fitxer CSV/XLSX corregit
7. Processar normalment

**Expected:**
- [ ] Modal d'inconsistència NO té botó "Reparar" (no existeix)
- [ ] Undo: filles antigues passen a `archivedAt` (soft-delete)
- [ ] Undo: pare torna a estat inicial (sense `isRemittance`)
- [ ] Process: filles noves creades correctament
- [ ] No hi ha filles duplicades actives
- [ ] Net del donant és correcte (suma noves, no suma arxivades)

---

### VF-9 UNDO idempotent

**Passos:**
1. Localitzar remesa pare processada
2. Executar "Desfer remesa" (1a vegada)
3. Esperar confirmació d'èxit
4. Executar "Desfer remesa" una 2a vegada (simular reintent)

**Expected:**
- [ ] 1a execució: desfà correctament, retorna èxit
- [ ] 2a execució: retorna `idempotent: true` sense errors
- [ ] No hi ha canvis addicionals a Firestore a la 2a execució
- [ ] Pare queda en estat net (sense `isRemittance`)

---

### VF-10 PROCESS idempotent

**Passos:**
1. Preparar CSV amb 3 ítems
2. Processar remesa (1a vegada)
3. Tornar a obrir el splitter amb el mateix pare
4. Pujar exactament el mateix CSV
5. Processar (2a vegada)

**Expected:**
- [ ] 1a execució: crea filles correctament
- [ ] 2a execució: retorna `idempotent: true` sense crear filles noves
- [ ] No hi ha filles duplicades
- [ ] Toast informa "Remesa ja processada"

---

### VF-11 INVARIANT bloqueja (R-SUM-1)

**Passos:**
1. Preparar CSV amb ítems que sumen diferent del pare (diferència > 2 cèntims)
2. Intentar processar remesa

**Expected:**
- [ ] Server retorna error codi `R-SUM-1`
- [ ] Toast mostra "Error de validació: la suma no coincideix"
- [ ] NO es creen filles (abort abans d'escriure)
- [ ] Pare queda intacte

---

### VF-12 LOCK impedeix doble processament

**Passos:**
1. Obrir dues pestanyes amb el mateix usuari
2. A pestanya A: iniciar processament d'una remesa
3. A pestanya B: intentar processar la mateixa remesa simultàniament

**Expected:**
- [ ] Una pestanya guanya i processa
- [ ] L'altra rep error `LOCKED_BY_OTHER`
- [ ] No hi ha corrupció de dades
- [ ] El lock s'allibera correctament (TTL 5min)

---

### VF-13 UI bloqueja eliminar fill de remesa

**Passos:**
1. Localitzar una transacció filla d'una remesa (`isRemittanceItem: true`)
2. Obrir menú d'accions (3 punts)
3. Intentar clicar "Eliminar"

**Expected:**
- [ ] Botó "Eliminar" està desactivat (disabled)
- [ ] Mostra text "Forma part d'una remesa"
- [ ] No es pot eliminar la filla individualment

---

### VF-14 archivedAt exclòs fiscalment (CRÍTIC)

**Passos:**
1. Localitzar un donant amb donacions (anotar net actual)
2. Processar una remesa que crea filles assignades a aquest donant
3. Verificar que el net del donant ha augmentat
4. Executar "Desfer remesa" (Undo)
5. Tornar a obrir fitxa donant
6. Generar certificat de donació (si aplica)

**Expected:**
- [ ] Després de l'undo, les filles tenen `archivedAt` amb timestamp
- [ ] Fitxa donant NO mostra les filles arxivades
- [ ] Net del donant torna a l'import original (abans de processar)
- [ ] Certificat NO inclou les quotes arxivades

---

### VF-15 Invariants d'import bancari (IMP-1 + IMP-2)

**Context:**
Validació funcional mínima obligatòria a una org de prova abans de prod.

**Passos (T1 — rang dedupe date/operationDate):**
1. A la org de prova, crea/importa un moviment existent:
   `date=2025-12-30`, `operationDate` buit/null, mateix compte bancari.
2. Importa un fitxer amb un moviment amb:
   `date=2025-12-30`, `operationDate=2026-01-02`, mateix import i descripció.
3. Obre el resum pre-importació.

**Expected T1:**
- [ ] El moviment NO apareix com a `NEW`
- [ ] Apareix com a duplicat segur o candidat (segons dades disponibles)

**Passos (T2 — candidats sense opt-in):**
1. En el mateix resum pre-importació, deixa **0 candidats seleccionats**.
2. Confirma importació.

**Expected T2:**
- [ ] El botó indica explícitament `Importar X nous (0 candidats)` abans de confirmar
- [ ] No s'importa cap `DUPLICATE_CANDIDATE`
- [ ] Només entren moviments `NEW`

---

### VF-16 Desfer devolucions remesa sense `remittanceId` (desktop + mòbil)

**Context:**
Hi ha remeses de devolucions legacy on el pare té `isRemittance=true` però no sempre `remittanceId`.

**Passos:**
1. Obrir `/{org}/dashboard/movimientos`.
2. Filtrar una remesa de devolucions (pare) amb `isRemittance=true` i sense `remittanceId`.
3. Obrir menú d'accions (desktop) i verificar que apareix "Desfer remesa".
4. Executar "Desfer remesa" i confirmar.
5. Repetir la validació en vista mòbil (mateix tipus de pare).

**Expected:**
- [ ] L'acció "Desfer remesa" és visible encara que falti `remittanceId`.
- [ ] L'undo s'executa correctament i arxiva filles fiscals.
- [ ] El pare queda resetejat (sense estat de remesa processada).
- [ ] En mòbil també existeix l'acció "Desfer remesa".

---

## 3. Resultat de la sessió

| Data | Executor | VF-1 | VF-2 | VF-3 | VF-4 | VF-5 | VF-6 | VF-7 | VF-8 | VF-9 | VF-10 | VF-11 | VF-12 | VF-13 | VF-14 | VF-15 | Notes |
|------|----------|------|------|------|------|------|------|------|------|------|-------|-------|-------|-------|-------|-------|-------|
| 2026-03-02 | Codex | - | - | PASS | PASS | - | - | - | - | - | - | - | - | - | - | - | Hotfix devolucions febrer 2026 validat: net donant i Model 182 alineats (returns + donationStatus=returned), tests fiscals ampliats, `scripts/verify-local.sh` i `scripts/verify-ci.sh` OK. |
| 2026-03-19 | Codex | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Integracio `main -> prod` per Stripe fiscal/UI sense canvis funcionals nous. En aquesta sessio s'han executat `scripts/verify-local.sh`, `scripts/verify-ci.sh`, `npm run typecheck` i `npm test` a `deploy/main-to-prod-stripe-20260319`. No s'han marcat PASS manuals del checklist fiscal perque no s'han executat proves manuals VF. |
| 2026-03-27 | Codex | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Ajust tecnic d'exportacio a `donations-report-generator` per normalitzar el buffer binari que es passa a `Blob`, sense tocar calcul fiscal ni criteri de dades. Evidencia automatica executada al branch net `codex/blog-bilingual-locale`: `npm run typecheck`, tests de blog bilingue i `scripts/verify-local.sh` OK. No s'han marcat PASS manuals del checklist fiscal perque no hi ha canvi funcional de flux fiscal. |
| 2026-03-29 | Codex | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Retoc visual del modal d'exclosos del Model 182 i blindatge del `Dialog`/`AlertDialog` per evitar overflow horitzontal i CTA fora de vista. Evidencia manual: captura i comprovacio real del modal a 860, 720, 640 i 390 px sense scroll horitzontal (`bodyScrollWidth == viewportWidth`), amb CTA visibles i text embolcallat correctament. Evidencia automatica: `npm run typecheck` i `npm run build` OK al worktree net de publicacio. |
| YYYY-MM-DD | Nom | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | |

---

## 4. Què fer si hi ha FAIL

1. **NO fer push** directe a prod
2. Documentar el FAIL amb detall (passos, error, screenshot)
3. Obrir issue o fix directe
4. Tornar a executar tot el checklist després del fix

---

*Última actualització: 2026-03-29*

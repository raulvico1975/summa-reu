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
| YYYY-MM-DD | Nom | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | |

---

## 4. Què fer si hi ha FAIL

1. **NO fer push** directe a prod
2. Documentar el FAIL amb detall (passos, error, screenshot)
3. Obrir issue o fix directe
4. Tornar a executar tot el checklist després del fix

---

*Última actualització: 2026-02-28*

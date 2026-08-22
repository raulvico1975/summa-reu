# Certificats de Donació: Criteri de Càlcul

> Versió 1.1 — Gener 2026

Aquest document defineix el criteri fiscal que Summa Social aplica per calcular l'import dels certificats de donació anuals i el Model 182.

Aquest criteri s'aplica a partir de la seva implantació a Summa Social i no modifica certificats ja emesos amb criteris anteriors.

---

## 1. Què es considera donació certificable

Una donació certificable és qualsevol transacció que compleix:

- `transactionType === 'donation'`
- `amount > 0` (ingrés positiu)
- `contactId` = ID del donant
- `date` dins l'any fiscal seleccionat
- `archivedAt` = `null` o `undefined` (transacció activa)

**S'exclouen (no compten):**
- Transaccions amb `archivedAt` (arxivades per soft-delete)

**No es filtra per:**
- `category` (qualsevol categoria d'ingrés)
- `source` (bancària, remesa, Stripe o manual), sempre que el moviment ja hagi quedat marcat com a `donation`

> **Nota:** Aquest criteri s'aplica exclusivament a certificats anuals i Model 182. Un ingrés positiu amb donant assignat no compta automàticament si continua sent `transactionType = 'normal'`.

### Com arriba una transacció a ser `donation` dins de Summa

Les vies operatives actuals són:

- **Marcat manual des de Moviments** amb el botó `182`
- **Remesa IN** processada, que crea quotes filles ja marcades com a donació fiscal
- **Stripe** imputat a un donant
- **Desglossament manual** d'un ingrés amb línies creades com a donació

Per tant, el motor fiscal no decideix per categoria o per origen visible a la taula, sinó per l'estat final del moviment: `transactionType === 'donation'`.

---

## 2. Com es tracten devolucions

Les devolucions **resten** del total certificable.

**Criteri de detecció:**
- `transactionType === 'return'`
- `contactId` = ID del donant
- `date` dins l'any fiscal
- `archivedAt` = `null` o `undefined` (devolució activa)

**S'exclouen:**
- `transactionType === 'return_fee'` (comissions bancàries no resten)
- Devolucions amb `archivedAt` (arxivades per soft-delete)

**Fórmula:**

```
Import Net = Donacions Brutes − |Devolucions|
```

El bloc de resum fiscal només apareix al PDF si hi ha devolucions:

El certificat anual mostra únicament l'import net certificable. No inclou el recompte de donacions, l'import brut, les devolucions ni un quadre de resum fiscal.

---

## 3. Relació Model 182 ↔ Certificats

Utilitzen **exactament el mateix criteri de càlcul**:

| Element | Model 182 | Certificat PDF |
|---------|-----------|----------------|
| Base càlcul | Import net | Import net |
| Detecció devolucions | `transactionType === 'return'` | `transactionType === 'return'` |
| Agrupació | Per donant/any | Per donant/any |
| Exclusió `return_fee` | Sí | Sí |

**Coherència garantida:** El que surt al Model 182 coincideix amb el certificat individual del donant.

---

## 4. Casos límit

| Cas | Comportament |
|-----|--------------|
| **Import net = 0 €** | No es genera certificat. Toast informatiu a l'usuari. |
| **Import net < 0 €** | Es mostra 0 € (mai negatiu). No es genera certificat. |
| **Devolució tardana** (gener 2026 d'una donació 2025) | La devolució compta al 2026, no al 2025. Cada any és independent. |
| **Devolució no vinculada** (`contactId = null`) | No afecta cap donant fins que s'assigni. |
| **Devolució assignada a donant diferent** | Resta del donant al qual s'assigna la devolució. Summa Social no infereix relacions automàtiques entre donacions i devolucions; la responsabilitat d'assignació correcta és de l'entitat. |
| **Múltiples devolucions mateix donant** | Es sumen totes i resten del total brut. |
| **Transacció arxivada** (`archivedAt` present) | No compta. Ni donacions ni devolucions arxivades afecten el càlcul. |
| **Remesa desfeta** | Les filles de la remesa queden amb `archivedAt` → no compten. |

---

## 5. Responsabilitat

> **Summa Social aplica un criteri fiscal conservador basat en la informació disponible; la correcta assignació de devolucions és responsabilitat de l'entitat.**

Aquest criteri garanteix coherència entre certificats emesos a donants i la informació declarada a l'Agència Tributària mitjançant el Model 182.

---

## Accés i minimització de dades

Els certificats poden generar-se amb `fiscal.certificats.generar` sense concedir `moviments.read`.

Per a perfils de gestió de donants sense accés a Informes, el flux suportat és generar el certificat anual des de la fitxa del donant o soci. Aquest cas està validat en producció amb un perfil que no té `sections.informes`, `sections.moviments` ni `moviments.read`.

En perfils fiscals restringits, Summa Social usa una API server-side acotada (`POST /api/fiscal/certificates/summary`) que calcula imports amb la mateixa font fiscal consolidada però retorna només dades mínimes per al certificat:

- dades fiscals del donant necessàries per emetre el certificat
- any fiscal
- import brut, devolucions, import net i recompte

No retorna l'històric general de moviments, conceptes bancaris, categories, documents, IBAN, comptes bancaris, notes ni IDs reals de transacció.

---

## Components que implementen aquest criteri

- `donation-certificate-generator.tsx` — Generador massiu (Model 182 i certificats en lot)
- `donor-detail-drawer.tsx` — Certificat anual individual des del detall del donant
- `POST /api/fiscal/certificates/summary` — Resum fiscal acotat per certificats sense exposar ledger
- `certificate-summaries.ts` — Projecció sanitzada de dades certificables
- Enviament per email — Mateix PDF que la descàrrega

---

## Historial de versions

| Versió | Data | Canvis |
|--------|------|--------|
| 1.2 | Maig 2026 | Afegit criteri d'accés acotat: generar certificats no implica lectura general de moviments |
| 1.1 | Gener 2026 | Afegit criteri `archivedAt`: transaccions arxivades no compten |
| 1.0 | Desembre 2025 | Versió inicial |

# ADR — Stripe deixa de ser “dividir remesa” i passa a ser “imputar donacions sobre abonament bancari”

**Data:** 2026-03-17
**Estat:** Acceptat a nivell funcional. Pendent de requeriments i implementació.

## 1. Context

El model actual tracta Stripe com una remesa especial:
- moviment pare bancari
- agrupació per payout
- creació de filles
- fiscalitat basada en filles `donation`

Això consta explícitament a la documentació vigent:
- `docs/SUMMA-SOCIAL-REFERENCIA-COMPLETA.md`
- `docs/manual-usuari-summa-social.md`
- `docs/FAQ_SUMMA_SOCIAL.md`

## 2. Problema

L'objectiu real de l'entitat no és veure filles al ledger, sinó:
- saber a quins donants correspon un abonament Stripe
- registrar l'import brut de cada donació
- deixar correcte el Model 182

El model de remesa és massa comptable per a una necessitat principalment fiscal i operativa. Barreja la representació del banc amb la imputació de donacions i complica una pantalla de Moviments que hauria de mostrar només banc real.

## 3. Decisió

Es fixa aquest criteri funcional:
- a Moviments només es veu el moviment bancari pare
- les imputacions Stripe no es mostren a la taula de Moviments
- cada pagament Stripe imputat genera una donació bruta vinculada a donant, pare bancari i identificador Stripe (`stripePaymentId`)
- la comissió o ajust Stripe no es tracta com a “filla visible de remesa” a Moviments

## 4. Invariants no negociables

- el pare bancari no es modifica ni desapareix
- Model 182 i certificats surten de donacions brutes assignades a donant
- no crear donants automàticament
- matching per email només com a ajuda inicial
- flux reversible: desfer i reimputar
- anti-duplicació per `stripePaymentId`
- `archivedAt` continua excloent fiscalitat quan pertoqui

## 5. Model recomanat

S'adopta l'opció 3 com a únic model vàlid:
- donacions normals a nivell de donant
- vinculades al pare bancari
- excloses del ledger visual de Moviments
- compten a fiscalitat i a la fitxa del donant
- el banc continua mostrant només el moviment pare

Stripe deixa de ser un flux de “dividir remesa” i passa a ser un flux d'imputació de donacions sobre un abonament bancari existent.

## 6. Conseqüències

**Positives**
- model més alineat amb l'ús real
- Moviments queda net i fidel al banc
- fiscalitat correcta sobre import brut
- millor explicabilitat per a usuari i suport

**Costos**
- cal redefinir el contracte Stripe actual
- cal revisar undo, visibilitat i lectures fiscals
- cal migrar documentació i llenguatge de producte

## 7. Impacte documental

Aquest ADR implica revisar explícitament:
- `docs/SUMMA-SOCIAL-REFERENCIA-COMPLETA.md` apartat Stripe i contracte resumit
- `docs/manual-usuari-summa-social.md` secció 8 “Com dividir un payout de Stripe”
- `docs/FAQ_SUMMA_SOCIAL.md` FAQs Stripe actuals sobre “dividir remesa” i “desfer remesa”
- microajuda in-app si encara agrupa Stripe dins remeses

## Fora d'abast d'aquesta decisió

- connexió amb API de Stripe
- fuzzy matching
- auto-creació de donants
- qualsevol implementació tècnica o canvi de codi en aquesta fase

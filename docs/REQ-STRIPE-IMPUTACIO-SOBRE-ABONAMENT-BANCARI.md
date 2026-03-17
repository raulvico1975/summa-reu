# Requeriments — Stripe com a imputació sobre abonament bancari

**Data:** 2026-03-17
**Base funcional:** [ADR-STRIPE-IMPUTACIO-SOBRE-ABONAMENT-BANCARI.md](/Users/raulvico/Documents/summa-social/docs/ADR-STRIPE-IMPUTACIO-SOBRE-ABONAMENT-BANCARI.md)
**Abast:** requeriments funcionals i de model. Sense codi.

## 1. Model de dades

Les donacions Stripe es creen com a entitats normals de donació. Camps obligatoris:
- `contactId`
- `amountGross`
- `stripePaymentId`
- `parentTransactionId`
- `source: "stripe"`

## 2. Visibilitat

Aquestes donacions:
- NO apareixen a Moviments
- SÍ apareixen a la fitxa del donant
- SÍ apareixen al mòdul fiscal (Model 182)
- SÍ apareixen als exports que pertoquin

## 3. Anti-duplicació

La clau única és `stripePaymentId`.
Qualsevol intent de tornar a imputar un `stripePaymentId` ja registrat s'ha de bloquejar amb un missatge clar. El flux ha de ser idempotent de cap a cap.

## 4. Flux d'imputació

Des d'un moviment bancari:
- obrir "Imputar Stripe"
- carregar CSV
- llistar pagaments detectats
- preassignació per email
- edició manual
- confirmació final
- crear donacions

## 5. Ajustos Stripe

No es crea cap "remesa".
Es permet una línia agregada opcional amb `type: "stripe_adjustment"`.
Aquesta línia no és fiscal i no s'ha de mostrar com a filla visible de Moviments.

## 6. Undo

"Desfer imputació Stripe" ha de:
- eliminar les donacions associades al `parentTransactionId`
- mantenir el moviment bancari intacte

El resultat ha de permetre reimputar sense deixar residu funcional ni fiscal.

## 7. Guardrails

- no crear donants automàticament
- no fuzzy matching
- no tocar la conciliació bancària base
- idempotència total

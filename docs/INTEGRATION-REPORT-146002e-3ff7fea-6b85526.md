# Integration Report: 146002e + 3ff7fea + 6b85526

## Estat

Branca d'integracio preparada per QA conjunta. No hi ha merge a `main` ni deploy.

## Conflictes trobats

- `git cherry-pick 3ff7fea`: buit sobre la base actual (`main`)
- `git cherry-pick 146002e`: buit sobre la base actual (`main`)
- `git cherry-pick 6b85526`: aplicat correctament
- Conflictes textuals manuals: cap

## Com s'han resolt

- Els dos primers `cherry-pick` s'han resolt amb `git cherry-pick --skip` perque Git ha detectat que no aportaven canvis nous sobre la base actual.
- El tercer `cherry-pick` s'ha aplicat directament, sense editar fitxers manualment.
- La validacio s'ha executat reutilitzant temporalment `node_modules` del repo principal via enllac local, eliminat en acabar.

## Fitxers finals afectats

### Diferencia efectiva d'aquesta branca respecte `main`

- `src/components/contact-combobox.tsx`
- `src/components/transactions-table.tsx`
- `src/components/transactions/components/TransactionRow.tsx`
- `src/lib/__tests__/inline-update-state.test.ts`
- `src/lib/transactions/inline-update-state.ts`
- `docs/INTEGRATION-REPORT-146002e-3ff7fea-6b85526.md`

### Blocs inclosos en el resultat d'integracio

- `3ff7fea`: contracte `operationDate` + dedupe oficial ja present/equivalent a la base
- `146002e`: Stripe bloc 1 ja present/equivalent a la base
- `6b85526`: reactivitat inline de Moviments aplicada en aquesta branca

## Validacio executada

- `tsc --noEmit`
- `node --import tsx --test src/lib/__tests__/bank-import-dedupe-invariants.test.ts src/lib/__tests__/bank-import-idempotency.test.ts src/lib/__tests__/transaction-dedupe-balance.test.ts src/lib/__tests__/transaction-dedupe-real-life.test.ts`
- `node --import tsx --test src/lib/__tests__/can-delete-transaction.test.ts src/lib/__tests__/read-models-transactions.test.ts src/lib/__tests__/remittance-visibility.test.ts src/lib/__tests__/stripe-import-chunking.test.ts tests/transactions/split-render.test.ts`
- `node --import tsx --test src/lib/__tests__/inline-update-state.test.ts`

## Riscos oberts per QA

- Verificar a UI la convivencia real entre:
  - Stripe split amb pare preservat
  - imports bancaris sense duplicacio indeguda
  - estat `DUPLICATE_SAFE` vs `DUPLICATE_CANDIDATE`
  - updates inline de contacte/categoria amb i sense filtre
  - rollback visible quan falla Firestore
- Com que els dos primers commits ja eren equivalents a la base, el risc no es de merge textual sino de regressio funcional creuada en pantalla.

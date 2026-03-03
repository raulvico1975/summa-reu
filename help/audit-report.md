# Audit capa Help (guies + bot)

- Data: 2026-03-03T08:51:24.835Z
- Guies detectades UI: 41
- Topics operatius: 5
- Guies sense topic: 36
- Topics sense guia UI: 0

## Cobertura guies

| Guide ID | Ruta UI | Topic operatiu | Estat |
|---|---|---|---|
| firstDay | /dashboard/configuracion | - | missing-topic |
| firstMonth | /dashboard/movimientos | - | missing-topic |
| monthClose | /dashboard/movimientos | - | missing-topic |
| movements | /dashboard/movimientos | - | missing-topic |
| importMovements | /dashboard/movimientos | movement-import-bank | covered |
| bulkCategory | /dashboard/movimientos | - | missing-topic |
| changePeriod | /dashboard/movimientos | - | missing-topic |
| selectBankAccount | /dashboard/movimientos | - | missing-topic |
| attachDocument | /dashboard/movimientos | - | missing-topic |
| returns | /dashboard/movimientos | - | missing-topic |
| remittances | /dashboard/movimientos | - | missing-topic |
| splitRemittance | /dashboard/movimientos | split-remittance | covered |
| stripeDonations | /dashboard/movimientos | stripe-import | covered |
| travelReceipts | /dashboard/project-module/expenses/capture | - | missing-topic |
| travelExpenseReport | /dashboard/movimientos/liquidacions | - | missing-topic |
| mileageTravel | /dashboard/movimientos/liquidacions | - | missing-topic |
| donors | /dashboard/donants | donor-create | covered |
| reports | /dashboard/informes | - | missing-topic |
| projects | /dashboard/project-module/expenses | project-open | covered |
| monthlyFlow | /dashboard/movimientos | - | missing-topic |
| yearEndFiscal | /dashboard/informes | - | missing-topic |
| accessSecurity | /dashboard | - | missing-topic |
| initialLoad | /dashboard/movimientos | - | missing-topic |
| changeLanguage | /dashboard/configuracion | - | missing-topic |
| importDonors | /dashboard/donants | - | missing-topic |
| generateDonorCertificate | /dashboard/donants | - | missing-topic |
| model182HasErrors | /dashboard/donants | - | missing-topic |
| model182 | /dashboard/informes | - | missing-topic |
| model347 | /dashboard/informes | - | missing-topic |
| certificatesBatch | /dashboard/informes | - | missing-topic |
| donorSetInactive | /dashboard/donants | - | missing-topic |
| donorReactivate | /dashboard/donants | - | missing-topic |
| editMovement | /dashboard/movimientos | - | missing-topic |
| movementFilters | /dashboard/movimientos | - | missing-topic |
| bulkAICategorize | /dashboard/movimientos | - | missing-topic |
| remittanceViewDetail | /dashboard/movimientos | - | missing-topic |
| resetPassword | /login | - | missing-topic |
| updateExistingDonors | /dashboard/donants | - | missing-topic |
| remittanceLowMembers | /dashboard/movimientos | - | missing-topic |
| saveRemittanceMapping | /dashboard/movimientos | - | missing-topic |
| toggleRemittanceItems | /dashboard/movimientos | - | missing-topic |

## Divergencia Storage

- No s ha pogut llegir Storage.

| Lang | Error |
|---|---|
| ca | Missing FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET |
| es | Missing FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET |
| fr | Missing FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET |
| pt | Missing FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET |

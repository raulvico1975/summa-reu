manual_updated: no
faq_updated: no
justification_if_no_change: El comportament canvia només al mòdul Projectes i no altera el flux ni la guia operativa de Moviments o FAQ general.

Què ha canviat

- El mòdul `Projectes > Assignació de despeses` ja no bloqueja ni tracta com a cas especial les despeses bancàries sense categoria global.
- Les despeses bancàries elegibles amb categoria `null`, `Revisar` o equivalent es poden seleccionar, imputar i editar igual que la resta.
- El feed de projectes continua admetent aquestes despeses sense afegir cap filtre nou per categoria.

Per què importa a l'usuari

- Es trenca la dependència funcional entre la classificació global a `Moviments` i la imputació a projecte.
- L'equip pot avançar la justificació o l'assignació de projecte encara que la categoria global del moviment estigui pendent.

Com ho notarà

- Una despesa bancària sense categoria apareixerà a l'assignació de despeses amb comportament normal.
- Es podrà marcar, fer `quick assign`, imputar des del detall i incloure en el filtre de no assignades sense cap avís específic per categoria.

Ha de fer alguna acció?

- No.
- La classificació global continua gestionant-se a `Moviments`, però ja no impedeix imputar la despesa al mòdul `Projectes`.

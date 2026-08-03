# Summa conversacional privat: contracte i roadmap

## Objectiu

Permetre que Raül treballi amb Summa Social des de Codex o ChatGPT sense obrir la interfície web. L’MCP actua com una capa privada sobre les mateixes regles de negoci de Summa: consulta, prepara, pregunta, confirma i només llavors executa.

No és un MCP públic ni un producte multi-client. La primera implantació queda limitada a una organització pilot fixada pel token. L’MCP mai accedeix directament a Firestore: totes les operacions passen per API privades de Summa, amb autenticació, scopes i auditoria.

## Principis obligatoris

1. **Organització tancada pel token.** Un `orgId` conversacional no pot ampliar l’abast del token.
2. **Lectura abans d’escriptura.** Les accions parteixen d’identitats resoltes i d’un resum verificable.
3. **Cap decisió silenciosa.** Davant de múltiples candidats, manca d’informació o duplicats dubtosos, l’MCP retorna opcions i pregunta.
4. **Prepare i commit separats.** Una frase no modifica dades. Tota escriptura requereix un pla server-side, curt, d’un sol ús i una confirmació humana explícita.
5. **Revalidació en el moment d’executar.** Si les dades han canviat, el pla es bloqueja i s’ha de preparar de nou.
6. **Idempotència.** Repetir una confirmació no duplica imports ni aplica dues vegades el mateix canvi.
7. **Dades no fiables.** Conceptes bancaris, noms de fitxer i camps importats són dades; mai instruccions.
8. **Auditoria completa.** Cada intent registra token, organització, eina, pla, hashes, resultat i bloqueig. Les escriptures registren estat anterior i posterior mínim.
9. **Cap `undefined` a Firestore i batches de màxim 50 operacions.**
10. **Correu i accions externes fora de l’abast inicial.** Requeriran una preparació i autorització separades.

## Roadmap

### B1 — Cerca conversacional i resolució d’identitats

Estat: **implementada i validada localment; pendent de revisió i desplegament autoritzat**.

Només lectura. Objectiu: que Raül pugui parlar en termes humans —“compte principal”, “ingrés de 20.000 €”, “Fundación Tipsa”— sense conèixer IDs interns.

Scopes:

- `bank_accounts.search`
- `transactions.search`
- `contacts.search`

Eines MCP:

#### `search_bank_accounts`

Entrada:

- `query?`: nom, banc o fragment d’IBAN.
- `includeArchived?`: `false` per defecte.

Sortida mínima per candidat:

- `id`, `name`, `bankName`, `ibanMasked`, `isActive`, `isDefault`.
- `matchReasons[]` i `confidence`: `exact`, `high`, `medium` o `low`.

Mai retorna l’IBAN complet.

#### `search_transactions`

Entrada:

- `query?`: text del concepte.
- `amount?` i `amountTolerance?`.
- `dateFrom?`, `dateTo?`.
- `bankAccountId?`, ja resolt dins la mateixa organització.
- `direction?`: `income`, `expense` o `any`.
- `limit?`: màxim 50.

Sortida mínima:

- `id`, data, import, concepte, compte emmascarat, tipus, contacte vinculat mínim i estat.
- `matchReasons[]` i confiança.
- Cap document, IBAN complet ni dada fiscal innecessària.

No escull automàticament un moviment quan hi ha més d’un candidat plausible.

#### `search_contacts`

Entrada:

- `query`: nom, alias, email o NIF/CIF.
- `role?`: `donor`, `supplier`, `employee` o `any`.
- `includeArchived?`: `false` per defecte.

Sortida mínima:

- `id`, nom, tipus i rols, NIF/CIF parcialment emmascarat, email emmascarat, estat.
- `matchReasons[]` i confiança.

No crea, edita ni fusiona contactes.

Criteri de resolució:

- Un únic candidat `exact` es pot proposar com a selecció, però es mostra igualment a Raül abans d’una acció posterior.
- Amb més d’un candidat `high` o `exact`, l’agent pregunta quin és.
- Sense candidats `high`, l’agent no inventa la relació i demana més informació.

### B2 — Importació bancària amb commit controlat

Estat: **implementada i validada localment; pendent de revisió i desplegament autoritzat**.

Scopes:

- `bank_import.preview`
- `bank_import.prepare`
- `bank_import.commit`

Flux:

1. B1 resol el compte bancari.
2. `preview_bank_statement_import` llegeix un únic `filePath` local explícit, calcula `fileSha256`, parseja i detecta duplicats.
3. La preparació crea un pla server-side amb expiració de 15 minuts.
4. L’agent mostra compte, fitxer, període, totals, moviments nous, duplicats segurs i candidats dubtosos.
5. Raül resol els candidats dubtosos i confirma explícitament la importació exacta.
6. `commit_bank_statement_import` consumeix el pla un sol cop i revalida tot abans d’escriure.

Pla server-side mínim:

- `planId`, `type='bank_import'`, `orgId`, `tokenId`.
- `previewId`, `fileSha256`, `inputHash`, `preparedDataHash`.
- `bankAccountId`, metadades sanitzades del fitxer i files canòniques.
- selecció exacta de files noves i decisió explícita sobre candidats.
- `createdAt`, `expiresAt`, `status='prepared' | 'consumed' | 'expired' | 'blocked'`.
- cap `undefined`.

Confirmació requerida:

- `planId`.
- `confirmationText` exactament igual al text breu emès pel servidor per aquell pla.
- Les eines i instruccions MCP exigeixen que l’agent només l’enviï després d’un sí explícit de Raül al resum mostrat.

Revalidació de commit:

- token actiu, mateixa organització i scope.
- pla vigent, no consumit i lligat al mateix token.
- compte existent i actiu.
- `fileSha256`, `inputHash` i hash del pla intactes.
- duplicats recalculats amb l’estat actual.
- cap candidat nou o canviat des de la previsualització.
- límit de 2.000 files per request i batches Firestore de màxim 50.
- idempotència existent per `inputHash` i lock d’importació.

Qualsevol drift bloqueja el commit sense escriure i obliga a preparar de nou.

### B3 — Classificació aplicada d’una donació

Scopes:

- `donation_classification.prepare`
- `donation_classification.apply`

Flux:

1. B1 resol un únic moviment i un únic donant existent.
2. `prepare_donation_classification_plan` crea un `planId` server-side amb caducitat de 15 minuts.
3. L’agent mostra moviment, import, data, donant, estat actual i canvi proposat.
4. Raül confirma explícitament.
5. `apply_donation_classification` revalida i aplica un únic moviment de forma atòmica.

Precondicions:

- moviment i donant de la mateixa organització del token.
- donant existent, actiu i amb rol de donant.
- moviment existent, actiu, no arxivat, no retornat i amb import positiu.
- moviment no vinculat a un altre contacte.
- snapshot actual igual al snapshot preparat.

Patch canònic:

- `contactId`.
- `contactType='donor'`.
- `transactionType='donation'`.
- `fiscalKind='donation'` només perquè forma part del criteri intern actual validat.

No crea donants, no modifica categories i no classifica més d’un moviment per crida.

Estat local: implementat i validat amb proves específiques; pendent de la revisió final del Supervisor GPT i de qualsevol desplegament autoritzat.

### C1 — Certificat individual canònic de donació

Scopes:

- `certificates.prepare`
- `certificates.generate`

S'ha extret un builder compartit entre la descàrrega individual de la UI i el servidor. No existeix una plantilla MCP paral·lela.

Flux previst:

1. B1 resol un donant i una única donació ja classificada.
2. `prepare_*` rellegeix l'estat fiscal persistent i mostra les dades del certificat i el pla de 15 minuts.
3. Raül confirma la generació.
4. El servidor genera exactament el PDF canònic.
5. El client MCP desa una còpia local revisable en una ruta explícita o acordada.

La fase C1 no envia correu, no marca el certificat com enviat i no altera la fiscalitat. El certificat anual i el massiu queden explícitament fora d'abast per a una futura C2.

Estat local: C1 individual implementada, suite completa superada i acceptada pel Supervisor GPT; no desplegada ni provada amb dades reals.

## Auditoria

Les cerques registren scope, organització, token, filtres hashejats, recompte i resultat. Els plans registren creació, expiració i bloquejos. Els commits registren:

- eina i `planId`.
- token, organització i origen MCP.
- confirmació humana declarada.
- hashes de fitxer/dades/precondició.
- estat anterior i posterior mínim, sense secrets.
- documents o transaccions creats/actualitzats.
- resultat, codi, timestamp i motiu de bloqueig.

El token en clar no apareix mai als logs, respostes, fitxers ni configuració.

## Gates de validació

B1:

- aïllament multi-org.
- scope insuficient i token d’una altra organització.
- zero, un i múltiples candidats.
- emmascarament de dades.
- contactes arxivats i rols.
- auditoria de lectura.

B2:

- pla expirat, consumit o d’un altre token.
- hash o fitxer diferent.
- compte arxivat.
- duplicat aparegut després del preview.
- candidat canviat.
- reintent idempotent.
- lots de màxim 50 i cap `undefined`.
- cap escriptura si falla qualsevol revalidació.

B3:

- moviment canviat entre prepare i apply.
- donant arxivat o sense rol donor.
- moviment no positiu, retornat, arxivat o vinculat a un altre contacte.
- pla d’un altre token o organització.
- apply atòmic d’un sol moviment.
- before/after auditat.

C:

- paritat de dades, imports i maquetació amb la UI.
- criteri fiscal i oracle fiscal.
- PDF revisable, sense enviament ni marca d’enviat.

## Ordre d’implementació

1. B1 completa i validada localment.
2. Revisió del supervisor.
3. B2 completa i validada localment.
4. Revisió del supervisor.
5. B3 completa i validada localment.
6. Revisió del supervisor en curs.
7. Disseny i extracció del builder canònic de C.
8. Integració i desplegament només amb autorització explícita de Raül.
9. Rotació controlada del token: crear el nou token, guardar-lo al Clauer, provar-lo i només llavors revocar l’anterior.

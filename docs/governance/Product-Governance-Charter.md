# Product Governance Charter

**Govern del producte Summa Social**  
*Versió 3.1 · intern · actualitzat el 19 abril 2026*

## 1. Propòsit

Aquest document fixa els límits de producte i de servei de Summa Social perquè les decisions futures siguin coherents amb el que el sistema és avui.

La font funcional principal continua sent:

- `docs/SUMMA-SOCIAL-REFERENCIA-COMPLETA.md`

Aquest charter resumeix criteris de govern, no substitueix el document mestre.

## 2. Naturalesa del producte

Summa Social és:

- software especialitzat per a entitats socials d'Espanya
- orientat a operativa financera real
- pensat per creixement controlat i acompanyament directe
- mantingut sota un model de servei prudent, no de SaaS massiu

Summa Social **no** és:

- un ERP generalista
- una comptabilitat formal completa
- un CRM comercial genèric
- una plataforma multi-país
- una integració bancària Open Banking

## 3. Blocs de producte vigents

Els blocs estratègics actius són tres:

### 3.1 Conciliació bancària real

Inclou:

- multicomptes bancaris
- imports d'extractes
- categorització i matching determinista
- remeses i devolucions
- controls d'integritat i diagnòstic

### 3.2 Fiscalitat fina orientada a gestoria

Inclou:

- Model 182
- Model 347
- certificats de donació
- export per AEAT i gestoria
- importador Stripe dins el flux fiscal real

### 3.3 Projectes, documents i justificació econòmica

Inclou:

- documents pendents
- liquidacions
- despeses de terreny
- projectes, partides i assignacions
- export per al finançador

## 4. Capacitats complementàries admeses

També formen part del producte quan reforcen els blocs anteriors:

- dashboard i mètriques
- gestió de contactes i permisos
- i18n i contingut públic
- ajuda contextual, guies i support bot
- eines internes de SuperAdmin
- backup/export local per a suport, migració o auditoria

Estat vigent d'aquest bloc:

- el bot d'ajuda dins del dashboard es considera funcionalitat viva de producte, no experiment paral·lel
- el seu criteri de valor és resoldre dubtes reals d'usuari a producció amb resposta útil i segura
- qualsevol evolució futura del bot segueix el flux normal de producte: branca pròpia, validació, PR, `main` i producció si aporta valor clar

## 5. Criteris de priorització

Davant de noves decisions, l'ordre és:

1. protegir integritat de dades i fiscalitat
2. reforçar conciliació i fluxos reals d'usuari
3. reduir risc operatiu i suport manual
4. millorar justificació econòmica i exportabilitat
5. només després, millores secundàries de confort o expansió

## 6. Regles de govern

### 6.1 Qualsevol canvi ha de respectar

- document mestre
- patrons de codi obligatoris
- invariants Firestore i fiscals
- model actual Next.js + Firebase

### 6.2 No es consideren línies de producte actives

- backups al núvol per a clients
- funcionalitats de voluntariat
- onboarding self-service
- expansió a ERP complet
- automatismes no supervisats que decideixin per l'entitat en àrees fiscals o de conciliació

## 7. Model de servei

El producte s'ofereix sota un model prudent:

- alta implicació manual en onboarding i suport
- creixement limitat
- decisions de desplegament i risc molt controlades
- preferència per fiabilitat davant expansió ràpida

La política comercial exacta, preus o capacitat màxima operativa poden canviar; aquest document només fixa que el model no és de creixement massiu ni autoservei obert.

## 8. Risc i incidents crítics

Es consideren crítics, com a mínim:

- pèrdua de dades
- càlcul fiscal erroni
- corrupció d'invariants de remeses o imports
- impossibilitat de recuperar informació clau d'una entitat

Davant d'un incident crític:

- es prioritza estabilització
- no s'expandeix abast
- es congelen canvis no essencials fins entendre la causa

## 9. Sortida i no lock-in

Principi:

> Cap entitat ha de quedar bloquejada dins del producte.

Mecanisme actiu avui:

- backup local complet en JSON, generat per SuperAdmin

Mecanismes complementaris:

- exportacions parcials JSON/CSV al panell `super-admin` d'organització

Important:

- els backups al núvol no formen part del contracte actiu del producte perquè estan desactivats per defecte
- el format canònic de sortida actual és JSON

## 10. Decisions que requereixen elevació explícita

Cal decisió explícita abans de tirar endavant si es proposa:

- afegir una línia de producte fora dels 3 blocs
- activar funcionalitats cloud desactivades
- introduir dependències noves amb impacte arquitectònic
- canviar esquemes de dades de forma destructiva
- convertir Summa Social en producte autoservei massiu

## 11. Documents relacionats

- `docs/SUMMA-SOCIAL-REFERENCIA-COMPLETA.md`
- `docs/DEV-SOLO-MANUAL.md`
- `docs/PATRONS-CODI-OBLIGATORIS.md`
- `docs/trust/Data-Exit-Plan.md`
- `docs/contracts/Service-Agreement-Template.md`

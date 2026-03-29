# Admin Panel Proposal — Usuari Unic No Tecnic

## 1. Objectiu

Redefinir `/admin` com un panell de decisio i seguiment per a una sola persona usuaria, no tecnica, que necessita:

- entendre en 5 segons si hi ha alguna cosa important
- saber que ha de fer ara mateix
- trobar ajuda clara quan dubta
- no veure eines internes, rituals legacy o arquitectura tecnica

Aquest panell no ha de ser una consola de manteniment. Ha de ser un centre de control tranquil, clar i accionable.

## 2. Perfil d'us

Usuari principal:
- Raül
- coneixement funcional alt del producte
- coneixement tecnic baix o variable
- necessita visio global, criteri i memoria externa

Conseqüencia de disseny:
- el panell ha d'explicar, no pressuposa
- cada bloc ha de respondre una pregunta humana
- cada alerta ha d'acabar amb una accio concreta
- qualsevol capa "interna" ha de quedar oculta o molt clarament marcada com a tecnica

## 3. Problema actual

La pantalla actual barreja cinc coses que per a aquest perfil no s'han de barrejar:

1. Resum executiu
2. Gestio d'entitats
3. Contingut visible per a usuaris
4. Eines internes/editorials
5. Diagnostics i operacions tecniques

Aixo genera tres danys:

- costa entendre que passa de veritat
- costa saber quina es la font de veritat
- costa distingir "accio meva" de "tema tecnic"

## 4. Principi de producte

Nova regla del panell:

> El panell nomes mostra allo que Raül ha de saber, decidir o fer.

La resta:
- s'amaga
- es mou a una area tecnica separada
- o es retira si ja no forma part del flux real

## 5. Nova arquitectura

Proposta d'estructura principal:

1. Vista general
2. Contingut visible
3. Entitats
4. Ajuda guiada
5. Area tecnica

### 5.1 Vista general

Ha de ser la landing per defecte.

Pregunta que respon:
- "Avui hi ha alguna cosa que requereixi atencio meva?"

Contingut:
- capcalera amb missatge resum
- 3 targetes maximes:
  - `Tot en ordre`
  - `Hi ha 1-2 punts per revisar`
  - `Hi ha un bloqueig important`
- bloc `Que cal fer ara`
- bloc `Ultims canvis visibles`
- bloc `Ajuda rapida`

No hi ha d'haver:
- taules llargues
- sentinelles
- metrics tecniques
- terminologia de runtime, KB o i18n

### 5.2 Contingut visible

Pregunta que respon:
- "Que veuran els usuaris i que puc editar jo sense risc?"

Contingut:
- `Ajudes de pantalla`
- `Traduccions visibles`
- `Novetats publicades`

Canvi clau:
- eliminar del front visible la idea de `guies` com a hub autonom
- si `guies.*` continua existint internament, no s'ha de vendre com a superficie de producte

Missatge base:
- "Aqui gestiones el text que veuen els usuaris. Si una cosa es interna o tecnica, no surt aqui."

### 5.3 Entitats

Pregunta que respon:
- "Quines entitats necessiten una accio meva?"

Contingut:
- cercador senzill
- llistat resum amb estat clar
- filtres humans:
  - `Actives`
  - `Pendents`
  - `Aturades`
  - `Necessiten revisio`

Cada fila ha de mostrar:
- nom
- estat
- ultima activitat
- una sola accio principal
- una accio secundaria dins "Mes opcions"

S'ha d'evitar:
- menus densos
- massa botons alhora
- text fiscal o intern en primera capa

### 5.4 Ajuda guiada

Pregunta que respon:
- "Si no recordo com va una cosa, on comenco?"

Aquesta area no es el manual complet. Es una entrada amable.

Contingut:
- `Necessito editar una ajuda`
- `Necessito revisar textos`
- `No trobo una resposta al bot`
- `Necessito entendre una incidencia`

Cada targeta obre:
- una explicacio curta
- el cami recomanat
- un boto clar

Exemple:
- `No trobo una resposta al bot`
- text: "Si el bot falla o respon ambigu, mira primer quina pregunta li han fet i si ja existeix ajuda visible per a aquest cas."
- boto: `Veure preguntes sense bona resposta`

### 5.5 Area tecnica

Aquesta area ha d'estar separada visualment i mentalment.

Etiqueta:
- `Area tecnica (nomes quan cal)`

Pregunta que respon:
- "Hi ha algun problema del sistema que hagi de passar a revisio tecnica?"

Contingut:
- incidencies reals
- checks nocturns
- links a Firebase/Cloud Logging
- eines de suport i diagnostica

Regla:
- no apareix a la home com a capa principal
- nomes s'hi entra si hi ha un motiu

## 6. Home nova: proposta de contingut

## 6.1 Capcalera

Titular variable:
- `Tot esta estable`
- `Hi ha coses pendents de revisio`
- `Hi ha un tema important per resoldre`

Subtext:
- una frase humana, sense tecnicismes
- exemple: `No hi ha cap bloqueig greu. Tens 2 punts de contingut per revisar i 1 entitat pendent.`

CTA principal:
- `Veure que cal fer ara`

CTA secundaria:
- `Obrir ajuda`

## 6.2 Bloc "Que cal fer ara"

Aquest ha de ser el centre real del panell.

Format:
- llista de 3-5 accions maximes

Cada item ha de tenir:
- titol directe
- per que importa
- accio principal

Exemple:
- `Revisar una ajuda incompleta`
- `Hi ha una pantalla amb text pendent en algun idioma.`
- boto: `Obrir ajudes`

## 6.3 Bloc "Estat del negoci"

No tecnic. Nomes tres indicadors:

- `Entitats actives`
- `Punts pendents`
- `Ultima novetat publicada`

Sense:
- severitats
- sentinelles
- comptadors d'alerta sense context

## 6.4 Bloc "Si alguna cosa falla"

Petit bloc d'orientacio:

- `El sistema no carrega be`
- `El bot no respon com toca`
- `Hi ha una incidencia oberta`

Cadascun amb un boto curt.

Objectiu:
- reduir l'ansietat
- donar un primer pas clar

## 7. Simplificacio per superfícies

### 7.1 Contingut

Conservar:
- edicio d'ajudes visibles
- traduccions visibles
- historial simple de novetats publicades

Retallar o moure:
- editor de `guies` com a promesa visible
- missatges que diguin que publicar una guia impacta directament bot/app si no es literalment cert
- export JSON legacy
- rituals d'importacio manual si el flux real ja es server-to-server

### 7.2 Bot

Per a Raül, la pregunta no es "quina KB consumeix el runtime?".

La pregunta bona es:
- "El bot esta ajudant be o hi ha preguntes que no resol?"

Per tant, la UI ha de mostrar:
- nombre de preguntes recents
- preguntes amb mala resposta o ambiguïtat
- temes repetits
- boto `Veure que cal millorar`

La referencia tecnica a `docs/kb/cards/**/*.json` pot existir, pero dins area tecnica.

### 7.3 Novetats

Nova regla UX:
- si el flux oficial es automatic o server-to-server, l'admin no ha de suggerir un ritual manual principal

La UI de `Novetats` hauria de quedar en dos nivells:

- capa visible:
  - que esta publicat
  - ultima publicacio
  - si hi ha algun esborrany pendent de revisio humana

- capa interna:
  - origen tecnic de la publicacio
  - detalls de `openclaw`
  - operacions manuals excepcionals

### 7.4 Incidencies

Nova distincio obligatoria:

- `Bloquejos reals`
- `Avisos per revisar`
- `Control tecnic`

No tot pot pujar a `warning` amb el mateix pes visual.

Proposta:
- la home nomes mostra `bloquejos reals`
- els avisos menors queden resumits
- el detall tecnic queda enterrat a l'area tecnica

### 7.5 Configuracio

Nomes hi han de quedar coses que realment siguin de decisio humana:

- accessos sensibles
- alta d'entitats
- accions administratives excepcionals

Qualsevol operacio rara, destructiva o de manteniment:
- dins area tecnica
- amb copy de risc molt clar

## 8. Sistema d'ajuda integrat

Aquest panell ha d'estar especialment assistit.

## 8.1 Ajuda contextual a cada seccio

Cada seccio ha de tenir:
- `Que veig aqui`
- `Quan ho he de tocar`
- `Quan no cal tocar-ho`

Format:
- 3 frases maximes
- llenguatge directe

## 8.2 Glossari intern

Afegir definicions curtes per termes que avui creen confusio:

- `Novetat publicada`
- `Ajuda de pantalla`
- `Traduccio pendent`
- `Incidencia oberta`
- `Esborrany intern`

No com a pagina separada.
Millor com a tooltip o microcopy.

## 8.3 Missatges amb tranquil·litat

Microcopy recomanada:

- en lloc de `critical`: `Requereix atencio ara`
- en lloc de `warning`: `Convé revisar-ho`
- en lloc de `publishedCompleteAllLangs`: `Ja esta llest`
- en lloc de `draft`: `Encara no visible`

## 9. Wireframe funcional

```text
/admin

[ Resum d'avui ]
Tot esta estable. Tens 2 punts pendents de contingut i cap bloqueig greu.
[ Veure que cal fer ara ] [ Obrir ajuda ]

[ Que cal fer ara ]
- Revisar una ajuda incompleta ................ [ Obrir ]
- Confirmar una novetat publicada ............. [ Veure ]
- Revisar una entitat pendent ................. [ Obrir ]

[ Estat general ]
Entitats actives | Punts pendents | Ultima novetat

[ Contingut visible ]
Ajudes | Traduccions | Novetats

[ Si alguna cosa falla ]
Bot | Incidencies | Contacte tecnic

[ Area tecnica ]
Nomes quan cal revisar un problema intern ...... [ Obrir ]
```

## 10. Coses a retirar o amagar en la primera fase

- card de `bot` basada en runtime intern
- promesa visible de `guies`
- exportacions legacy de novetats
- detall de sentinelles a la home
- semafor tecnic com a primera capa
- comptadors sense context
- llenguatge `KB`, `runtime`, `draftStatus`, `publishedStatus`

## 11. Pla d'implementacio

### Fase 1

Sense tocar els fluxos reals:
- simplificar navegacio
- crear nova home no tecnica
- moure diagnostica a `Area tecnica`
- reescriure microcopy

### Fase 2

Neteja de contracte:
- retallar promeses falses de `guies`
- alinear `Novetats` amb el flux real
- separar `Contingut visible` de `Contingut intern`

### Fase 3

Retirada de soroll legacy:
- ocultar o eliminar eines que ja no formen part del proces habitual
- deixar excepcions manuals clarament marcades com a "nomes en casos especials"

## 12. Criteris d'acceptacio

El nou panell es bo si:

- en 5 segons s'enten que passa avui
- cada alerta porta una accio clara
- no cal entendre arquitectura interna per usar-lo
- no hi ha dues fonts de veritat visibles per al mateix tema
- el llenguatge es huma, no de sistema
- la home dona calma, no pressio

## 13. Decisio de producte recomanada

Recomanacio clara:

- convertir `/admin` en un panell executiu i assistit
- relegar la diagnostica a una area secundaria
- tancar `guies` com a capa interna
- fer de `Contingut visible` la unica area editorial que promet coses a l'usuari final

Si hem de prioritzar una sola idea, aquesta es la mes important:

> Raül no ha de veure com funciona el sistema. Ha de veure que esta passant, si cal fer alguna cosa i quin es el seguent pas.

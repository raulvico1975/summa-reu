# Help Redesign QA Go/No-Go

## Abast revisat

- Validacio funcional dels tres entry points visibles: `HelpSheet`, `Manual`, `Bot`.
- Verificacio de les pantalles clau demanades: Dashboard, Moviments, Donants, Remeses, Informes fiscals, Configuracio/usuaris/permisos.
- Comprovacio d'anchors entre ajuda contextual i manual public.
- Revisio del contracte real de `guides` a runtime, KB i documentacio principal.
- Aquesta iteracio no amplia el sistema: nomes valida coherencia final i retalla contradiccions.

## Casos provats

### A. HelpSheet

| Cas | Resultat |
| --- | --- |
| Dashboard: `?` obre ajuda correcta, titol coherent, 5 passos, anchor `14-entendre-el-dashboard` existent | PASS |
| Moviments: `?` obre ajuda correcta, titol coherent, 5 passos, anchor `5-gestio-de-moviments` existent | PASS |
| Donants: `?` obre ajuda correcta, titol coherent, 5 passos, anchor `3-gestio-de-donants` existent | PASS |
| Remeses de cobrament: `?` obre ajuda correcta, titol coherent, 5 passos, anchor `6a-remeses-sepa-de-cobrament` existent | PASS |
| Informes: `?` obre ajuda correcta, titol coherent, 6 passos, anchor `9-informes-fiscals` existent | PASS |
| Configuracio: `?` obre ajuda correcta, titol coherent, 4 passos, anchor `2-configuracio-inicial` existent | PASS |
| Liquidacions: `?` obre ajuda correcta, titol coherent, 5 passos, anchor `6c-liquidacions-de-despeses-de-viatge` existent | PASS |

### B. Manual

| Cas | Resultat |
| --- | --- |
| `/dashboard/manual` carrega el manual public i el TOC | PASS |
| Els anchors usats per `HelpSheet` existeixen en CA/ES/FR | PASS |
| Els anchors nous de remeses i liquidacions existeixen al manual public | PASS |
| Els links del bot apunten a destins manuals o pantalles reals, no a `guides` | PASS |
| Hi ha troubleshooting visible als punts critics revisats (remeses, fiscalitat, accessos) | PASS |

### C. Bot (20 preguntes reals)

| Pregunta | Resultat | Desti correcte | Evita suport huma |
| --- | --- | --- | --- |
| com importar l'extracte del banc | operativa | SI | SI |
| per que em detecta duplicats | operativa | SI | SI |
| com importar donacions de stripe | operativa | SI | SI |
| em diu que falten columnes a l'importacio | operativa | SI | SI |
| com categoritzo molts moviments de cop | operativa | SI | SI |
| com desfer una remesa | operativa | SI | SI |
| he retornat una quota | operativa | SI | SI |
| que faig si una remesa no quadra | operativa | SI | SI |
| puc reprocessar una remesa ja processada? | operativa | SI | SI |
| com generar una remesa sepa | operativa | SI | SI |
| on veig l'historial d'un donant | operativa | SI | SI |
| com canvio la quota d'un soci | operativa | SI | SI |
| com actualitzo les dades d'un donant | clarify | SI | NO |
| com dono de baixa un donant | operativa | SI | SI |
| com trec el model 182 | operativa | SI | SI |
| com generar certificats | operativa | SI | SI |
| com faig el model 347 | operativa | SI | SI |
| no puc entrar | operativa | SI | SI |
| com canvio permisos d'un usuari | operativa | SI | SI |
| un usuari nomes pot mirar sense editar? | operativa | SI | SI |

## Incoherencies detectades

- La contradiccio principal que quedava era documental: el document mestre encara conservava dues entrades historiques parlant de "Hub de Guies". S'ha corregit per deixar clar que `guides.*` es una capa editorial interna i no un hub visible.
- `guides.*`, `docs/kb/cards/guides/*` i la seva validacio i18n continuen existint com a compatibilitat/editorial interna. No s'exposen com a experiencia visible per a usuari final.
- El bot encara te un cas millorable en donants (`com actualitzo les dades d'un donant`), on resol amb una desambiguacio util en comptes d'una resposta operativa directa.

## Decisio final

### GO WITH FIXES

La experiencia visible ja es coherent en els tres entry points i `guides` queda tancat com a capa interna, no com a promesa de producte. Tot i aixi, no marco `GO` net perque encara hi ha una correccio funcional petita pendent al bot en el cas generic d'actualitzacio de dades d'un donant, i el namespace `guides.*` continua viu internament com a compatibilitat/editorial. No es un risc greu de runtime, pero abans de produccio convindria o be acceptar explicitament aquest contracte intern, o be retallar encara mes aquesta superficie legacy.

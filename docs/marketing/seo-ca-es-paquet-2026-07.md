# Paquet SEO CA/ES basat en demanda real

## Resultat buscat

Augmentar les visites orgàniques qualificades de Summa Social concentrant el treball en les pàgines que Google ja està provant, sense crear volum artificial de contingut ni prometre posicions.

## Evidència de Search Console

Lectura verificada el 27 de juliol de 2026 sobre els darrers tres mesos:

| Indicador | Valor |
|---|---:|
| Clics | 11 |
| Impressions | 275 |
| CTR | 4% |
| Posició mitjana | 8,8 |
| Pàgines indexades | 93 |
| Pàgines no indexades | 75 |
| Rastreades però no indexades | 42 |

Oportunitats observades:

- `/es/certificats-donacio`: 54 impressions i 3 clics;
- article ES sobre devolucions de rebuts: 52 impressions i 0 clics;
- `/ca/gestio-donants`: 16 impressions i 0 clics;
- landings ES de conciliació, remeses i control de donacions rastrejades però encara no indexades;
- 26 enllaços externs detectats, tots provinents de dominis tècnics (`netlify.app`, `blogspot.com` i `vercel.app`), sense autoritat sectorial acreditada.

Amb aquest volum, les variacions encara no són una tendència consolidada. Les dades sí que permeten prioritzar què millorar primer.

## Canvis inclosos al paquet de codi

1. Cada targeta funcional de la home enllaça a la landing concreta que descriu:
   - certificats cap a `certificats-donacio`;
   - devolucions cap a `devolucions-rebuts-socis`;
   - importació bancària cap a `importar-extracte-bancari`;
   - Model 347, donacions i la resta de blocs cap a la seva pàgina específica.
2. La home CA/ES incorpora una navegació visible i compacta cap a cinc problemes comercials prioritaris.
3. Les versions FR/PT de la home deixen d’enllaçar landings pendents i deriven el detall complet cap a ES, tal com ja feia la pàgina de funcionalitats.
4. S’escurcen i precisen els títols i descripcions de certificats, donants, devolucions, conciliació i control de donacions.
5. Els fitxers de subtítols `.vtt` reben `X-Robots-Tag: noindex` perquè no apareguin com a URL de contingut a Search Console.
6. Es mantenen les pàgines FR/PT existents i els seus idiomes públics; no s’aplica cap desindexació massiva.

## Actualització editorial preparada

El fitxer `blog-devolucions-ctr-patch-2026-07.json` conté una actualització parcial CA/ES del post amb 52 impressions i cap clic.

La proposta substitueix un títol llarg i recriminatori per una formulació directa sobre la necessitat de cerca: com gestionar devolucions de rebuts en associacions.

L’actualització no s’ha aplicat al blog real. És una escriptura a producció independent del desplegament del codi i requereix autorització explícita de Raül.

## Autoritat externa

El paquet tècnic no crea enllaços externs. El següent bloc de creixement ha de buscar poques mencions editorials reals i contextuals:

- una referència útil des de l’ecosistema Semilla/GONG;
- el cas d’ús de Flores de Kiskeya, dins dels permisos ja acordats;
- una o dues entitats, federacions o assessories que coneguin l’equip.

No es preparen enviaments, peticions d’enllaç ni publicacions externes sense autorització.

## Mesura després de publicar

Comparar períodes de 28 dies:

- impressions i clics no vinculats a marca;
- CTR de certificats, devolucions i donants;
- nombre de landings CA/ES indexades;
- sessions orgàniques consentides;
- `contact_intent` i `generate_lead` procedents d’orgànic.

No s’ha de considerar èxit només una pujada d’impressions: l’objectiu és aconseguir visites qualificades i converses.

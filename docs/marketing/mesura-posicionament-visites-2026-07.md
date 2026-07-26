# Sistema de mesura de posicionament, visites i contactes

## Decisió que ha de suportar

Aquest sistema serveix per decidir si el web públic de Summa Social:

1. guanya visibilitat per problemes reals d’entitats;
2. rep visites qualificades;
3. converteix aquestes visites en converses.

No serveix per prometre posicions ni per confondre activitat de robots amb demanda real.

## Fonts canòniques

| Pregunta | Font | Mètrica |
|---|---|---|
| Google ens mostra més? | Search Console | impressions, clics, CTR i posició |
| Hi entra gent real? | Google Analytics 4 | usuaris actius, sessions i pàgines vistes |
| El web genera converses? | Google Analytics 4 | `generate_lead` i `contact_intent` |
| El servidor està rebent activitat? | App Hosting | peticions agregades, robots i pàgines |

Els logs d’App Hosting són una comprovació auxiliar. Les peticions de pàgina, les IP i les IP-dia no equivalen a visites, sessions ni persones.

## KPI seleccionats

### 1. Visibilitat orgànica

- **Resultat principal:** impressions no vinculades a marca.
- **Diagnòstic:** clics, CTR i posició mitjana.
- **Font:** Search Console.
- **Cadència:** comparació de 7 dies per detectar canvis i de 28 dies per decidir.
- **Cautela:** amb menys de 100 impressions per període no s’ha d’interpretar una variació percentual com una tendència consolidada.

### 2. Trànsit qualificat

- **Resultat principal:** sessions al web públic.
- **Diagnòstic:** usuaris actius, pàgines vistes, pàgina d’entrada i font/mitjà.
- **Font:** GA4.
- **Cadència:** 28 dies contra els 28 anteriors.
- **Cautela:** només es mesuren les persones que accepten expressament l’analítica.

### 3. Converses generades

- **Resultat principal:** `generate_lead`, només després que l’API confirmi l’enviament del formulari.
- **Indicador previ:** `contact_intent` per clics cap a contacte, correu, telèfon o WhatsApp.
- **Font:** GA4.
- **Cadència:** mensual.
- **Cautela:** un clic no és una conversa; només `generate_lead` acredita un formulari enviat.

## Privacitat i qualitat

- Implementació de consentiment bàsic: l’etiqueta de Google no es descarrega abans de l’acceptació.
- Publicitat i personalització queden desactivades.
- No s’envien noms, correus, organitzacions, telèfons ni missatges.
- La preferència es pot retirar des de la política de privacitat.
- Sense `NEXT_PUBLIC_GA_MEASUREMENT_ID`, el sistema de captura queda completament inactiu.

## Informe operatiu

Comanda:

```bash
npm run marketing:report -- --days 28
```

Per defecte genera:

- `tmp/marketing/summa-marketing-<data>-28d.md`
- `tmp/marketing/summa-marketing-<data>-28d.json`

L’informe compara dos períodes consecutius i declara cada font com a disponible o no disponible. No substitueix una font absent per una mètrica més feble.

Variables:

```bash
export GOOGLE_MARKETING_ACCESS_TOKEN="<token OAuth temporal>"
export SEARCH_CONSOLE_SITE_URL="sc-domain:summasocial.app"
export GA4_PROPERTY_ID="547126832"
```

El token necessita els àmbits de només lectura:

- `https://www.googleapis.com/auth/webmasters.readonly`
- `https://www.googleapis.com/auth/analytics.readonly`

No s’ha de guardar el token al repositori ni als artefactes.

## Estat de posada en marxa

Configuració creada el 27 de juliol de 2026:

- compte GA4 `Summa Social` (`402384810`);
- propietat `Summa Social – Web` (`547126832`);
- flux `Summa Social – Web públic` (`15329958834`);
- ID de mesura `G-C5NJMM8S5P`;
- zona horària d’Espanya, moneda euro i retenció d’esdeveniments de 14 mesos;
- mesura millorada activa;
- `generate_lead` creat amb codi i marcat com a esdeveniment clau, sense valor monetari predeterminat.

Passos de publicació i validació:

1. [x] Afegir `NEXT_PUBLIC_GA_MEASUREMENT_ID` a `apphosting.yaml`.
2. [x] Validar en local que rebutjar no genera cap petició a Google.
3. [ ] Obtenir autorització explícita de desplegament i executar `npm run publica`.
4. [ ] Validar amb DebugView que acceptar registra una sola visita i que el formulari només genera el lead després d’un `2xx`.

## Línia base verificada

Search Console, comparació del 18–24 de juliol de 2026 contra l’11–17 de juliol:

| Mètrica | 11–17 jul. | 18–24 jul. |
|---|---:|---:|
| Clics | 1 | 3 |
| Impressions | 20 | 31 |
| CTR | 5% | 9,7% |
| Posició mitjana | 12,3 | 7,0 |

És un senyal inicial positiu, però encara no una tendència consolidada.

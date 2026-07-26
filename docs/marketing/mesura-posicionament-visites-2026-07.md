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
export GA4_PROPERTY_ID="<id numèric>"
```

El token necessita els àmbits de només lectura:

- `https://www.googleapis.com/auth/webmasters.readonly`
- `https://www.googleapis.com/auth/analytics.readonly`

No s’ha de guardar el token al repositori ni als artefactes.

## Posada en marxa pendent d’autorització

1. Crear o seleccionar una propietat GA4 de Summa Social.
2. Crear el flux web per `https://summasocial.app`.
3. Activar la mesura millorada del flux, inclosos els canvis de pàgina.
4. Marcar `generate_lead` com a esdeveniment clau.
5. Afegir `NEXT_PUBLIC_GA_MEASUREMENT_ID` a `apphosting.yaml`.
6. Validar en local que rebutjar no genera cap petició a Google.
7. Validar amb DebugView que acceptar registra una sola visita i que el formulari només genera el lead després d’un `2xx`.
8. Seguir el protocol `npm run acabat` → `npm run integra` → autorització explícita → `npm run publica`.

## Línia base verificada

Search Console, comparació del 18–24 de juliol de 2026 contra l’11–17 de juliol:

| Mètrica | 11–17 jul. | 18–24 jul. |
|---|---:|---:|
| Clics | 1 | 3 |
| Impressions | 20 | 31 |
| CTR | 5% | 9,7% |
| Posició mitjana | 12,3 | 7,0 |

És un senyal inicial positiu, però encara no una tendència consolidada.

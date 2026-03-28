# Contracte Editorial Octavi -> Summa

## Objectiu

Aquest contracte governa la capa editorial estable que `Octavi` fa servir per preparar, validar i moure peces de blog i derivades LinkedIn de `Summa Social`.

## Fonts obligatòries

- KB sectorial: `/mnt/data/KNOWLEDGE_BASE_Entitats.md`
- contracte del pipeline blog: `docs/contracts/blog-publish-cover-image.md`
- estructura i guardrails actuals del repo: `agents/AGENTS.md`
- context operatiu d'Octavi i OpenClaw: `docs/operations/SUMMA-INBOUND-FUNNEL.md`, `docs/operations/CONTEXT-OPERATIU-WEB-I-INTEGRACIONS.md`

## Contracte d'entrada

`summa-marketing` i els subagents han de treballar sempre a partir de:

- `octavi/summa/editorial/calendar/editorial-calendar.yaml`
- l'estat viu de `octavi/summa/editorial/runtime/queue-state.json`
- els artefactes generats dins `octavi/summa/editorial/artifacts/*`

No es pot inventar un post fora de calendari.

## Contracte de sortida

Per cada post:

- 1 draft de blog amb `contentHtml` publicable pel contracte existent
- 3 derivades LinkedIn
- 1 sol·licitud d'aprovació per Telegram
- 1 estat de cua actualitzat
- 1 registre a logs

## Regles de contingut

- llenguatge tècnic, operatiu i sectorial d'entitats
- cap to SaaS, cap promesa comercial buida, cap “growth language”
- no inventar clients, imports, percentatges, casos reals ni resultats
- no fer afirmacions que no es puguin sostenir amb el producte, la KB o el contracte operatiu
- el draft ha de tenir estructura clara, però no ha d'estar lligat a un únic esquelet fix per a tots els posts
- OpenClaw pot decidir l'angle i el desenvolupament del text dins dels guardrails editorials del calendari i del sector
- el copy públic no pot mencionar derivades LinkedIn, aprovacions, cues, prompts, KB ni cap altra metadada interna del pipeline

## Regles de flux

- Sense aprovació humana, no hi ha publicació live.
- La publicació al blog s'ha de fer només pel contracte existent de `/api/blog/publish`.
- La publicació LinkedIn pot ser live o mock, però sempre ha de deixar artefacte i estat.
- Els scripts han de poder operar en mode segur si falten credencials externes.

## Regles de repositori

- prohibit tocar `/srv/repos/summa-social`
- prohibit tocar `src/app/api/*` per implementar aquesta capa
- prohibit afegir dependències noves si no són imprescindibles

# Bucle de qualitat del bot d’ajuda

El bot manté la separació entre tres resultats:

- **Resposta amb card**: hi ha una card validada amb passos renderitzables.
- **Fallback segur**: no hi ha cobertura suficient o la consulta és sensible; el bot no inventa.
- **Consulta no resolta dins l’abast**: el benchmark espera una card però el bot acaba en fallback o en una altra resposta.

## Controls locals

Executa:

```bash
npm run support:eval
npm run support:eval:top100
node --import tsx docs/kb/validate-kb.ts
```

El benchmark Top-100 mostra ara `Card matches`, `Safe fallbacks` i `Unresolved in-scope`, a més de les mètriques anteriors. Un fallback segur no compta com una resposta operativa coberta.

## Revisió editorial

Per revisar preguntes reals d’una organització:

```bash
node --import tsx scripts/support/analyze-bot-logs.ts --org <orgId> --days 7 --out reports/bot-top-problems.json
```

Prioritza, en aquest ordre:

1. consultes operatives repetides amb fallback;
2. feedback negatiu amb prou mostra;
3. reformulacions després d’un fallback;
4. preguntes d’alta freqüència sense card.

Abans d’afegir una card, cal verificar el flux real a l’aplicació i documentar-ne la font. El report proposa candidats, però no crea cards automàticament ni publica canvis.

## Idiomes

El bot continua tenint contingut profund en català i castellà. El contracte de dades conserva `ca | es | fr | pt` i el fallback de llengua existent perquè es pugui incorporar FR/PT més endavant sense redissenyar l’API ni la UX.

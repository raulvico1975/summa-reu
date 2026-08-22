# Impacte funcional i sincronitzacio documental

## Metadata
- date: 2026-07-27
- change_scope: reforcar el posicionament organic de Summa Social en cercadors i assistents d'IA

## Declaracio obligatoria
- help_topics_updated: []
- manual_updated: no
- manual_sections: []
- faq_updated: no
- faq_questions: []
- justification_if_no_change: canvi exclusiu del web public, dels actius descarregables i de la mesura de captacio; no altera l'operativa de l'aplicacio ni requereix instruccions d'usuari

## Notes

- La home publica exposa un unic H1 semantic sense perdre l'animacio visual ni l'espai reservat entre frases.
- Les landings comercials incompletes en frances i portugues redirigeixen permanentment a la versio castellana equivalent, conservant els parametres de campanya.
- S'afegeix una plantilla gratuïta de conciliacio bancaria en catala i castella, en formats Excel i CSV, amb pagina indexable, dades estructurades i enllacos des del footer, el sitemap i `llms.txt`.
- IndexNow queda integrat com a notificacio no bloquejant despres d'una publicacio o actualitzacio de blog i d'un deploy validat. No s'envia res en entorns locals o de prova.
- L'informe de marketing separa les visites procedents de ChatGPT, Perplexity, Claude, Gemini i Copilot, i resumeix els rastrejadors d'IA declarats sense confondre'ls amb visites humanes.
- OAI-SearchBot es contrasta amb els rangs IPv4 oficials publicats per OpenAI; la resta de rastrejadors queden etiquetats nomes com a declarats.
- No hi ha dependencies noves, migracions ni canvis destructius de Firestore; tampoc s'escriu `undefined`.

## Impacte d'aquest canvi

### Metadata
- date: 2026-08-22
- change_scope: desglossament fiscal del Model 182 per separar donacions, devolucions i net canònic

### Declaracio obligatoria
- help_topics_updated: []
- manual_updated: no
- manual_sections: []
- faq_updated: no
- faq_questions: []
- justification_if_no_change: el contracte queda documentat al document mestre i a QA-FISCAL.md; no cal modificar el manual d'usuari ni la FAQ en aquest canvi intern fiscal

### Notes
- L'agregació compartida del Model 182 exposa Donacions brutes, Devolucions negatives una sola vegada i Net fiscal canònic.
- Una donació `returned` amb `return` vinculat continua visible al brut i al desglossament, sense doble impacte al net ni als exports oficials.
- QA-FISCAL.md incorpora els casos 70/-10/60, devolució parcial, exercici diferent i exclusió de net zero.
- No hi ha dependencies noves, migracions ni canvis destructius de Firestore; tampoc s'escriu `undefined`.

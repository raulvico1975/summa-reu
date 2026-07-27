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

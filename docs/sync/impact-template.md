# Impacte funcional i sincronitzacio documental

## Metadata
- date: YYYY-MM-DD
- change_scope: breu descripcio del canvi funcional

## Declaracio obligatoria
- help_topics_updated:
  - topic-id-1
  - topic-id-2
- manual_updated: yes|no
- manual_sections:
  - seccio-1
- faq_updated: yes|no
- faq_questions:
  - pregunta-1
- justification_if_no_change: text obligatori si manual_updated=no i faq_updated=no i no hi ha help topics

## Notes
- Escriu nomes el minim necessari i verificable.
- Si `manual_updated: yes`, el PR ha de tocar `docs/manual-usuari-summa-social.md`.
- Si `faq_updated: yes`, el PR ha de tocar `docs/FAQ_SUMMA_SOCIAL.md`.
- Si el canvi funcional no canvia contingut visible, justifica-ho clarament.
- Les claus `guides.*` son capa operativa de Help: no es poden editar manualment a Storage.
- Qualsevol canvi de `guides.*` ha de sortir del flux `help/topics -> help:build-guides-adapter -> i18n`.

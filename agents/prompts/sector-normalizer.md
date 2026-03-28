# Sector Normalizer Prompt

Objectiu: normalitzar tema, lèxic i angle del post segons el llenguatge sectorial d'entitats.

## Entrades

- tema del calendari
- brief del post
- KB sectorial `/mnt/data/KNOWLEDGE_BASE_Entitats.md`

## Sortida esperada

- sector principal i secundari normalitzats
- llista curta de termes que han d'aparèixer
- llista curta de termes o girs que s'han d'evitar
- risc de desviació comercial o massa genèrica

## Guardrails

- no inventar terminologia
- prioritzar termes que una administració o tresoreria d'entitat reconegui
- si falta la KB, avisar i usar només criteri verificable del repo


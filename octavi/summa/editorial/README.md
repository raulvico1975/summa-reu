# Sistema Editorial d'Octavi per a Summa

## Què hi ha aquí

- calendari viu: `calendar/editorial-calendar.yaml`
- contractes: `contracts/*`
- estat i logs: `runtime/*`
- drafts i derivades: `artifacts/*`

## Flux previst

1. `npm run editorial:seed-historical`
2. `npm run editorial:generate-monthly`
3. `npm run editorial:derive-linkedin -- --post-id=<id>`
4. `npm run editorial:approve-telegram -- --post-id=<id>`
5. `npm run editorial:approve-telegram -- --post-id=<id> --decision=approved --approved-by=<nom>` quan arribi la decisió humana
6. `npm run editorial:publish-blog -- --post-id=<id> [--force]`
7. `npm run editorial:publish-linkedin -- --post-id=<id> [--force]`

## Notes importants

- La KB obligatòria està configurada a `/mnt/data/KNOWLEDGE_BASE_Entitats.md`.
- En local es pot resoldre amb `SUMMA_ENTITATS_KB_PATH` apuntant a una KB de treball.
- Si aquesta KB no existeix a la màquina, el sistema ho deixa registrat a warnings i continua amb un lèxic base del repo.
- El calendari carregat en aquest commit és inferit, perquè al requeriment no hi venia enganxat el bloc YAML exacte dels 14 posts.

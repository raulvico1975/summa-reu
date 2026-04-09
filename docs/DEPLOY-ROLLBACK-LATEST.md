# Rollback Plan (auto) — Summa Social

Generat: 2026-04-09 11:48
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: a79006f1
SHA branca a publicar (main): 3f93124e

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 3f93124e --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard a79006f1
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-04-08 19:40
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: 280906c2
SHA branca a publicar (main): a9124b61

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert a9124b61 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 280906c2
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-08-23 21:50
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: 203fed377
SHA branca a publicar (main): d0dcfa1b2

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert d0dcfa1b2 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 203fed377
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-03-12 15:18
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: 1b8e346
SHA main a publicar: 9e9465c

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 9e9465c --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 1b8e346
git push origin prod --force-with-lease
```

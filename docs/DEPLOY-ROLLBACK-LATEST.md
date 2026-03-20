# Rollback Plan (auto) — Summa Social

Generat: 2026-03-20 10:55
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: 8afdc85
SHA main a publicar: 2f6d74e

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 2f6d74e --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 8afdc85
git push origin prod --force-with-lease
```

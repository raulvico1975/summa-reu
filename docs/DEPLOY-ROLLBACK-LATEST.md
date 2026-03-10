# Rollback Plan (auto) — Summa Social

Generat: 2026-03-10 22:56
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: 6ec3663
SHA main a publicar: bca0518

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert bca0518 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 6ec3663
git push origin prod --force-with-lease
```

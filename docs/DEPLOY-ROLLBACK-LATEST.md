# Rollback Plan (auto) — Summa Social

Generat: 2026-03-22 18:16
Risc: BAIX
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 5d1e3074
SHA main a publicar: a149947b

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert a149947b --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 5d1e3074
git push origin prod --force-with-lease
```

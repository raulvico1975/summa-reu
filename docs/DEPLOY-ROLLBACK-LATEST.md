# Rollback Plan (auto) — Summa Social

Generat: 2026-04-27 17:30
Risc: BAIX
Backup curt: NO_REQUIRED
SHA prod abans de publicar: a099804b
SHA branca a publicar (codex/weekly-product-updates-20260427): f60b6140

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout codex/weekly-product-updates-20260427
git revert f60b6140 --no-edit
git push origin codex/weekly-product-updates-20260427
bash scripts/deploy.sh codex/weekly-product-updates-20260427
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard a099804b
git push origin prod --force-with-lease
```

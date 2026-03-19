# Rollback Plan (auto) — Summa Social

Generat: 2026-03-17 19:01
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: c726548
SHA main a publicar: 1299650

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 1299650 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard c726548
git push origin prod --force-with-lease
```

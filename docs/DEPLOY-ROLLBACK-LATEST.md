# Rollback Plan (auto) — Summa Social

Generat: 2026-03-11 20:40
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: beea103
SHA main a publicar: f5b67ac

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert f5b67ac --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard beea103
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-03-29 18:50
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: fc8580b9
SHA branca a publicar (main): 5e496738

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 5e496738 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard fc8580b9
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-08-21 17:29
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: 1685a3c1a
SHA branca a publicar (main): aea13565c

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert aea13565c --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 1685a3c1a
git push origin prod --force-with-lease
```

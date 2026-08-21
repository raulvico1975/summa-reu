# Rollback Plan (auto) — Summa Social

Generat: 2026-08-21 19:19
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: 8c54de02d
SHA branca a publicar (main): 3ab69fb55

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 3ab69fb55 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 8c54de02d
git push origin prod --force-with-lease
```

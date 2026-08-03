# Rollback Plan (auto) — Summa Social

Generat: 2026-08-03 16:14
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: d4504be27
SHA branca a publicar (main): b65214561

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert b65214561 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard d4504be27
git push origin prod --force-with-lease
```

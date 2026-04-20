# Rollback Plan (auto) — Summa Social

Generat: 2026-04-20 11:18
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: bab2d479
SHA branca a publicar (main): 85baef37

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 85baef37 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard bab2d479
git push origin prod --force-with-lease
```

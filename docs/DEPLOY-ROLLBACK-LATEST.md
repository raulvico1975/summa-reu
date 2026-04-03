# Rollback Plan (auto) — Summa Social

Generat: 2026-04-03 13:53
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 91dcc2f2
SHA branca a publicar (main): d2befc33

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert d2befc33 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 91dcc2f2
git push origin prod --force-with-lease
```

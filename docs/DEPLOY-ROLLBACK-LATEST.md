# Rollback Plan (auto) — Summa Social

Generat: 2026-09-04 11:44
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 599471efa
SHA branca a publicar (main): dbc10d555

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert dbc10d555 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 599471efa
git push origin prod --force-with-lease
```

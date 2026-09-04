# Rollback Plan (auto) — Summa Social

Generat: 2026-09-04 09:55
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: c59298243
SHA branca a publicar (main): 2b930fbd1

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 2b930fbd1 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard c59298243
git push origin prod --force-with-lease
```

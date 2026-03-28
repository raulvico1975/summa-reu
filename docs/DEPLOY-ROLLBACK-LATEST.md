# Rollback Plan (auto) — Summa Social

Generat: 2026-03-28 21:01
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 1d2c90d3
SHA branca a publicar (main): 7d808567

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 7d808567 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 1d2c90d3
git push origin prod --force-with-lease
```

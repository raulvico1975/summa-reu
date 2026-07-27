# Rollback Plan (auto) — Summa Social

Generat: 2026-07-27 03:09
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 13a3945b0
SHA branca a publicar (main): 9fdc09729

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 9fdc09729 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 13a3945b0
git push origin prod --force-with-lease
```

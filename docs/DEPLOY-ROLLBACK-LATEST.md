# Rollback Plan (auto) — Summa Social

Generat: 2026-08-22 11:27
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 75211bbe5
SHA branca a publicar (main): f0b8d6dad

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert f0b8d6dad --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 75211bbe5
git push origin prod --force-with-lease
```

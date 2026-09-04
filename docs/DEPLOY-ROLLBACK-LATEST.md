# Rollback Plan (auto) — Summa Social

Generat: 2026-09-04 09:43
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 985d7eab5
SHA branca a publicar (main): 2635d3041

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 2635d3041 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 985d7eab5
git push origin prod --force-with-lease
```

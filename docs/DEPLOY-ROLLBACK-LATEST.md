# Rollback Plan (auto) — Summa Social

Generat: 2026-04-08 10:56
Risc: BAIX
Backup curt: NO_REQUIRED
SHA prod abans de publicar: cefe4c1f
SHA branca a publicar (main): 81e7b9ab

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 81e7b9ab --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard cefe4c1f
git push origin prod --force-with-lease
```

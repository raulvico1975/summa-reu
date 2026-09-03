# Rollback Plan (auto) — Summa Social

Generat: 2026-09-03 11:08
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 96f60536d
SHA branca a publicar (main): 45639da59

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 45639da59 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 96f60536d
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-09-04 09:16
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 2d4b7243f
SHA branca a publicar (main): 1530e0cbf

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 1530e0cbf --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 2d4b7243f
git push origin prod --force-with-lease
```

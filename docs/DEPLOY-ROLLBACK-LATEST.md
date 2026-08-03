# Rollback Plan (auto) — Summa Social

Generat: 2026-08-03 13:14
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 7b7ca1211
SHA branca a publicar (main): 6f826d0b7

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 6f826d0b7 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 7b7ca1211
git push origin prod --force-with-lease
```

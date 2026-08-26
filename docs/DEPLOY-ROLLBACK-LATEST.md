# Rollback Plan (auto) — Summa Social

Generat: 2026-08-26 07:50
Risc: BAIX
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 7ff7254d2
SHA branca a publicar (main): 2adff5fd3

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 2adff5fd3 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 7ff7254d2
git push origin prod --force-with-lease
```

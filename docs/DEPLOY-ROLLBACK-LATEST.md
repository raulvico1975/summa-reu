# Rollback Plan (auto) — Summa Social

Generat: 2026-04-28 12:04
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 348cb2791
SHA branca a publicar (main): 9ba87a6b9

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 9ba87a6b9 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 348cb2791
git push origin prod --force-with-lease
```

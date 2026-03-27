# Rollback Plan (auto) — Summa Social

Generat: 2026-03-27 08:30
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 21b0c872
SHA branca a publicar (main): 7fab2201

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 7fab2201 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 21b0c872
git push origin prod --force-with-lease
```

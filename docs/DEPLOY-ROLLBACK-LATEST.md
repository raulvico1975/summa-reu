# Rollback Plan (auto) — Summa Social

Generat: 2026-03-26 08:45
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: cb4d0989
SHA branca a publicar (main): 2a0e6ad4

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 2a0e6ad4 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard cb4d0989
git push origin prod --force-with-lease
```

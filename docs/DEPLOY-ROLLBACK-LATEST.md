# Rollback Plan (auto) — Summa Social

Generat: 2026-03-29 10:40
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 1da9c0bd
SHA branca a publicar (main): 2dd90a6e

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 2dd90a6e --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 1da9c0bd
git push origin prod --force-with-lease
```

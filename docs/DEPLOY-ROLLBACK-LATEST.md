# Rollback Plan (auto) — Summa Social

Generat: 2026-04-14 11:34
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 433c2b46c
SHA branca a publicar (main): a9e14797e

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert a9e14797e --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 433c2b46c
git push origin prod --force-with-lease
```

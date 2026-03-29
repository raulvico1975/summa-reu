# Rollback Plan (auto) — Summa Social

Generat: 2026-03-29 08:43
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 90ec5de3
SHA branca a publicar (main): 415fb16c

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 415fb16c --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 90ec5de3
git push origin prod --force-with-lease
```

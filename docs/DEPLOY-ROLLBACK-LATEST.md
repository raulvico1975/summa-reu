# Rollback Plan (auto) — Summa Social

Generat: 2026-04-09 19:59
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 98c91925e
SHA branca a publicar (main): 2b3462eec

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 2b3462eec --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 98c91925e
git push origin prod --force-with-lease
```

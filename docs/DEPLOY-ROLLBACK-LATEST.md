# Rollback Plan (auto) — Summa Social

Generat: 2026-04-17 11:31
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 8b3a65b55
SHA branca a publicar (main): 23e4d9943

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 23e4d9943 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 8b3a65b55
git push origin prod --force-with-lease
```

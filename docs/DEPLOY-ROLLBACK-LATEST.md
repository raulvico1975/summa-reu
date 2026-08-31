# Rollback Plan (auto) — Summa Social

Generat: 2026-08-31 14:53
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 265a83581
SHA branca a publicar (main): b71725288

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert b71725288 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 265a83581
git push origin prod --force-with-lease
```

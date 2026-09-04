# Rollback Plan (auto) — Summa Social

Generat: 2026-09-04 11:16
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: e685c865c
SHA branca a publicar (main): 5db97ebb7

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 5db97ebb7 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard e685c865c
git push origin prod --force-with-lease
```

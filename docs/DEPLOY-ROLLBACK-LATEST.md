# Rollback Plan (auto) — Summa Social

Generat: 2026-04-14 14:26
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 5a95af0e8
SHA branca a publicar (main): 08947956e

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 08947956e --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 5a95af0e8
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-04-14 13:52
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 2c9fb21d1
SHA branca a publicar (main): b85269c4c

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert b85269c4c --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 2c9fb21d1
git push origin prod --force-with-lease
```

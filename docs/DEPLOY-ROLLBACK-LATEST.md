# Rollback Plan (auto) — Summa Social

Generat: 2026-08-26 11:07
Risc: BAIX
Backup curt: NO_REQUIRED
SHA prod abans de publicar: b9e1cf934
SHA branca a publicar (main): ba70d70b4

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert ba70d70b4 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard b9e1cf934
git push origin prod --force-with-lease
```

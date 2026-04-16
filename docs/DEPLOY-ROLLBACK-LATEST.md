# Rollback Plan (auto) — Summa Social

Generat: 2026-04-16 10:51
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 0b1e9d51
SHA branca a publicar (main): ce819c77

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert ce819c77 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 0b1e9d51
git push origin prod --force-with-lease
```

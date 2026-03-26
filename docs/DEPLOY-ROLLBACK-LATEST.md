# Rollback Plan (auto) — Summa Social

Generat: 2026-03-26 18:06
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 6b045417
SHA branca a publicar (main): bf39d128

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert bf39d128 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 6b045417
git push origin prod --force-with-lease
```

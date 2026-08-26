# Rollback Plan (auto) — Summa Social

Generat: 2026-08-26 08:01
Risc: BAIX
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 7ff7254d2
SHA branca a publicar (main): f9ebe1143

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert f9ebe1143 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 7ff7254d2
git push origin prod --force-with-lease
```

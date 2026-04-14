# Rollback Plan (auto) — Summa Social

Generat: 2026-04-14 14:35
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 71f072dbf
SHA branca a publicar (main): fa37d4654

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert fa37d4654 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 71f072dbf
git push origin prod --force-with-lease
```

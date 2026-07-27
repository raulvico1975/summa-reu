# Rollback Plan (auto) — Summa Social

Generat: 2026-07-27 14:27
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: f4dc7eac1
SHA branca a publicar (main): e98b501c6

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert e98b501c6 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard f4dc7eac1
git push origin prod --force-with-lease
```

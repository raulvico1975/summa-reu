# Rollback Plan (auto) — Summa Social

Generat: 2026-03-02 17:46
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: f7881d1
SHA main a publicar: e84cd15

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert e84cd15 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard f7881d1
git push origin prod --force-with-lease
```

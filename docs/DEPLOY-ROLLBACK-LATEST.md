# Rollback Plan (auto) — Summa Social

Generat: 2026-03-14 09:56
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: d0fcba5
SHA main a publicar: b1e6297

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert b1e6297 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard d0fcba5
git push origin prod --force-with-lease
```

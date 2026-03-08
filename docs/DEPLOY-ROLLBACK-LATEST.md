# Rollback Plan (auto) — Summa Social

Generat: 2026-03-08 19:17
Risc: BAIX
Backup curt: NO_REQUIRED
SHA prod abans de publicar: d37ca024
SHA main a publicar: 60e4f98e

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 60e4f98e --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard d37ca024
git push origin prod --force-with-lease
```

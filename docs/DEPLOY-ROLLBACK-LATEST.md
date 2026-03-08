# Rollback Plan (auto) — Summa Social

Generat: 2026-03-08 12:26
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: ad4fb42b
SHA main a publicar: eb1513a5

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert eb1513a5 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard ad4fb42b
git push origin prod --force-with-lease
```

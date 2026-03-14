# Rollback Plan (auto) — Summa Social

Generat: 2026-03-14 10:03
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 99b6240
SHA main a publicar: b876a75

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert b876a75 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 99b6240
git push origin prod --force-with-lease
```

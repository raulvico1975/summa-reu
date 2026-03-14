# Rollback Plan (auto) — Summa Social

Generat: 2026-03-14 10:00
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 8fef0d1
SHA main a publicar: a1e0d53

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert a1e0d53 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 8fef0d1
git push origin prod --force-with-lease
```

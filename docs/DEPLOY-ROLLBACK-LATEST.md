# Rollback Plan (auto) — Summa Social

Generat: 2026-03-07 09:02
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 2eb7edf
SHA main a publicar: a04dab1

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert a04dab1 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 2eb7edf
git push origin prod --force-with-lease
```

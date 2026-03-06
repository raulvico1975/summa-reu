# Rollback Plan (auto) — Summa Social

Generat: 2026-03-06 10:17
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 8dbcf37
SHA main a publicar: 55386e8

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 55386e8 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 8dbcf37
git push origin prod --force-with-lease
```

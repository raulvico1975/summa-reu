# Rollback Plan (auto) — Summa Social

Generat: 2026-03-07 20:08
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 4bd891a
SHA main a publicar: 06ad2f3

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 06ad2f3 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 4bd891a
git push origin prod --force-with-lease
```

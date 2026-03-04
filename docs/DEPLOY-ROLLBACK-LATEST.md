# Rollback Plan (auto) — Summa Social

Generat: 2026-03-04 10:03
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 1ba2769
SHA main a publicar: 5efd73a

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 5efd73a --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 1ba2769
git push origin prod --force-with-lease
```

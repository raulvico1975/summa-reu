# Rollback Plan (auto) — Summa Social

Generat: 2026-03-10 13:07
Risc: BAIX
Backup curt: NO_REQUIRED
SHA prod abans de publicar: fe39c49
SHA main a publicar: 3168167

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 3168167 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard fe39c49
git push origin prod --force-with-lease
```

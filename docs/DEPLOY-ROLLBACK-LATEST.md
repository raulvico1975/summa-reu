# Rollback Plan (auto) — Summa Social

Generat: 2026-03-05 16:35
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: d5069a8
SHA main a publicar: 6b3e484

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 6b3e484 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard d5069a8
git push origin prod --force-with-lease
```

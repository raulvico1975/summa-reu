# Rollback Plan (auto) — Summa Social

Generat: 2026-03-19 12:09
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: e35464d
SHA main a publicar: c109d3d

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert c109d3d --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard e35464d
git push origin prod --force-with-lease
```

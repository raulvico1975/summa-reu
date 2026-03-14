# Rollback Plan (auto) — Summa Social

Generat: 2026-03-14 08:25
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 0820ea9
SHA main a publicar: d7e3d6e

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert d7e3d6e --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 0820ea9
git push origin prod --force-with-lease
```

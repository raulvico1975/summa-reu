# Rollback Plan (auto) — Summa Social

Generat: 2026-03-23 07:48
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 4f1a1ee6
SHA main a publicar: 03d0343d

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 03d0343d --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 4f1a1ee6
git push origin prod --force-with-lease
```

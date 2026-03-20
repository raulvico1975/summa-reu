# Rollback Plan (auto) — Summa Social

Generat: 2026-03-20 12:38
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 153cf66
SHA main a publicar: e22174b

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert e22174b --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 153cf66
git push origin prod --force-with-lease
```

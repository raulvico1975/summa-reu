# Rollback Plan (auto) — Summa Social

Generat: 2026-03-16 16:25
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 575e22c
SHA main a publicar: 54d93d2

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 54d93d2 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 575e22c
git push origin prod --force-with-lease
```

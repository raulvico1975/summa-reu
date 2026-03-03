# Rollback Plan (auto) — Summa Social

Generat: 2026-03-03 16:59
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 923c3c3c
SHA main a publicar: 840a1e9f

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 840a1e9f --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 923c3c3c
git push origin prod --force-with-lease
```

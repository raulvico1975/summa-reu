# Rollback Plan (auto) — Summa Social

Generat: 2026-03-04 08:29
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: d4047fb
SHA main a publicar: 75a631e

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 75a631e --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard d4047fb
git push origin prod --force-with-lease
```

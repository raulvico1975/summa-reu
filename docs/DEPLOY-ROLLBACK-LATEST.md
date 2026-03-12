# Rollback Plan (auto) — Summa Social

Generat: 2026-03-12 14:05
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: 9273f74
SHA main a publicar: 1d61ca6

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 1d61ca6 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 9273f74
git push origin prod --force-with-lease
```

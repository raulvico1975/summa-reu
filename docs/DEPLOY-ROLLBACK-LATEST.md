# Rollback Plan (auto) — Summa Social

Generat: 2026-03-12 13:21
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: 145a279
SHA main a publicar: 265ae88

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 265ae88 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 145a279
git push origin prod --force-with-lease
```

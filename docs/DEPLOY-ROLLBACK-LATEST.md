# Rollback Plan (auto) — Summa Social

Generat: 2026-08-26 10:41
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: 67792883c
SHA branca a publicar (main): eaf23602e

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert eaf23602e --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 67792883c
git push origin prod --force-with-lease
```

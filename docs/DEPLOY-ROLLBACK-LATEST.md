# Rollback Plan (auto) — Summa Social

Generat: 2026-08-14 19:45
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: ebfb7028c
SHA branca a publicar (main): c684b3e20

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert c684b3e20 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard ebfb7028c
git push origin prod --force-with-lease
```

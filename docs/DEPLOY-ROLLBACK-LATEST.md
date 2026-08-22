# Rollback Plan (auto) — Summa Social

Generat: 2026-08-22 08:59
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: b3cd2ebf8
SHA branca a publicar (main): c8327b864

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert c8327b864 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard b3cd2ebf8
git push origin prod --force-with-lease
```

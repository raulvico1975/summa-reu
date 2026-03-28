# Rollback Plan (auto) — Summa Social

Generat: 2026-03-28 13:44
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: 86146550
SHA branca a publicar (main): ceb2393f

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert ceb2393f --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 86146550
git push origin prod --force-with-lease
```

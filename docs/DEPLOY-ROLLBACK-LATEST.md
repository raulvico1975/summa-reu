# Rollback Plan (auto) — Summa Social

Generat: 2026-04-22 18:42
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: a550d60c4
SHA branca a publicar (main): 3ee6df332

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 3ee6df332 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard a550d60c4
git push origin prod --force-with-lease
```

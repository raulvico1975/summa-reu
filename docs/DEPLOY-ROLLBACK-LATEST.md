# Rollback Plan (auto) — Summa Social

Generat: 2026-03-10 22:57
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: ef52573
SHA main a publicar: 6a84e42

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 6a84e42 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard ef52573
git push origin prod --force-with-lease
```

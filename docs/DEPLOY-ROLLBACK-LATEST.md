# Rollback Plan (auto) — Summa Social

Generat: 2026-04-10 15:34
Risc: BAIX
Backup curt: NO_REQUIRED
SHA prod abans de publicar: e000aa06
SHA branca a publicar (main): d549fbd9

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert d549fbd9 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard e000aa06
git push origin prod --force-with-lease
```

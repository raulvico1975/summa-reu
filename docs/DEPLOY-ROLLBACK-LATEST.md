# Rollback Plan (auto) — Summa Social

Generat: 2026-08-24 09:53
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: e75f9cb14
SHA branca a publicar (main): 21268f839

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 21268f839 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard e75f9cb14
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-04-19 21:53
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 5a810ac03
SHA branca a publicar (main): 6329d54a5

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 6329d54a5 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 5a810ac03
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-04-17 11:02
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 217ded5d6
SHA branca a publicar (main): 53d9d8e84

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 53d9d8e84 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 217ded5d6
git push origin prod --force-with-lease
```

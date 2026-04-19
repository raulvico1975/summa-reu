# Rollback Plan (auto) — Summa Social

Generat: 2026-04-19 12:58
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: ce7e4bca5
SHA branca a publicar (main): 7d4eb34b7

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 7d4eb34b7 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard ce7e4bca5
git push origin prod --force-with-lease
```

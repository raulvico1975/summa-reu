# Rollback Plan (auto) — Summa Social

Generat: 2026-08-31 15:05
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 265a83581
SHA branca a publicar (main): 722e29a4f

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 722e29a4f --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 265a83581
git push origin prod --force-with-lease
```

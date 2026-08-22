# Rollback Plan (auto) — Summa Social

Generat: 2026-08-22 13:40
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: cf07fc09b
SHA branca a publicar (main): 99a180524

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 99a180524 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard cf07fc09b
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-04-04 08:59
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: e732158e
SHA branca a publicar (main): e15176ac

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert e15176ac --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard e732158e
git push origin prod --force-with-lease
```

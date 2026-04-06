# Rollback Plan (auto) — Summa Social

Generat: 2026-04-06 10:23
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 306a7dfe
SHA branca a publicar (main): 3da687a0

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 3da687a0 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 306a7dfe
git push origin prod --force-with-lease
```

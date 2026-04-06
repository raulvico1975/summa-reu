# Rollback Plan (auto) — Summa Social

Generat: 2026-04-06 20:15
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: ee2512a0
SHA branca a publicar (main): e7553699

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert e7553699 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard ee2512a0
git push origin prod --force-with-lease
```

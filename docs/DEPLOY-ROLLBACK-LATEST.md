# Rollback Plan (auto) — Summa Social

Generat: 2026-04-04 10:57
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 115a9508
SHA branca a publicar (main): 6e47442f

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 6e47442f --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 115a9508
git push origin prod --force-with-lease
```

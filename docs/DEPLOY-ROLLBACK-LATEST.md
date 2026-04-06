# Rollback Plan (auto) — Summa Social

Generat: 2026-04-06 17:48
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: f3fde6a3
SHA branca a publicar (main): 4cd7bcb4

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 4cd7bcb4 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard f3fde6a3
git push origin prod --force-with-lease
```

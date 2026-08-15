# Rollback Plan (auto) — Summa Social

Generat: 2026-08-15 09:30
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: dd11e6026
SHA branca a publicar (main): 62e2157d8

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 62e2157d8 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard dd11e6026
git push origin prod --force-with-lease
```

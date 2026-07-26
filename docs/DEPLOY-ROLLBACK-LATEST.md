# Rollback Plan (auto) — Summa Social

Generat: 2026-07-27 01:48
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 6f356de5d
SHA branca a publicar (main): f11189be7

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert f11189be7 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 6f356de5d
git push origin prod --force-with-lease
```

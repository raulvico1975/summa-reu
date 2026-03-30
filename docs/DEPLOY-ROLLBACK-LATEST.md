# Rollback Plan (auto) — Summa Social

Generat: 2026-03-30 07:51
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 6d4bb83e
SHA branca a publicar (main): d84f2a18

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert d84f2a18 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 6d4bb83e
git push origin prod --force-with-lease
```

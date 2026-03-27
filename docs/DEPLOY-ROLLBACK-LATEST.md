# Rollback Plan (auto) — Summa Social

Generat: 2026-03-27 08:55
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 9bf56937
SHA branca a publicar (main): 3c29a94b

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 3c29a94b --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 9bf56937
git push origin prod --force-with-lease
```

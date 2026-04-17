# Rollback Plan (auto) — Summa Social

Generat: 2026-04-17 15:06
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 080ac3761
SHA branca a publicar (main): f18a10968

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert f18a10968 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 080ac3761
git push origin prod --force-with-lease
```

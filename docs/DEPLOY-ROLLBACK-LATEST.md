# Rollback Plan (auto) — Summa Social

Generat: 2026-04-08 10:31
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: e6dd43e1
SHA branca a publicar (main): d11849f2

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert d11849f2 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard e6dd43e1
git push origin prod --force-with-lease
```

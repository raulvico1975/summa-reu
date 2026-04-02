# Rollback Plan (auto) — Summa Social

Generat: 2026-04-02 12:07
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 1fd66216
SHA branca a publicar (main): f2d7ff3c

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert f2d7ff3c --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 1fd66216
git push origin prod --force-with-lease
```

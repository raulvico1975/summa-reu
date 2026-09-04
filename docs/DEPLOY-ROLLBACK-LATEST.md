# Rollback Plan (auto) — Summa Social

Generat: 2026-09-04 10:26
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: fd0d2d384
SHA branca a publicar (main): 280e42115

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 280e42115 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard fd0d2d384
git push origin prod --force-with-lease
```

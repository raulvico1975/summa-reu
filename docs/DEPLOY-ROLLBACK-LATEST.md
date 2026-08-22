# Rollback Plan (auto) — Summa Social

Generat: 2026-08-22 13:26
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: a0e4fe0a1
SHA branca a publicar (main): d6e404de6

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert d6e404de6 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard a0e4fe0a1
git push origin prod --force-with-lease
```

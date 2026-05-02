# Rollback Plan (auto) — Summa Social

Generat: 2026-05-02 19:04
Risc: BAIX
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 1c57a8af1
SHA branca a publicar (main): 45c599626

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 45c599626 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 1c57a8af1
git push origin prod --force-with-lease
```

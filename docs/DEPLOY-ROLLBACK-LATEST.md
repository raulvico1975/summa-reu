# Rollback Plan (auto) — Summa Social

Generat: 2026-03-26 09:17
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: c70158a9
SHA branca a publicar (main): 3b09c11b

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 3b09c11b --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard c70158a9
git push origin prod --force-with-lease
```

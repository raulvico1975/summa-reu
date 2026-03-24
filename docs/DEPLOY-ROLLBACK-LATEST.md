# Rollback Plan (auto) — Summa Social

Generat: 2026-03-24 16:04
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 7b725e30
SHA branca a publicar (main): bf31762b

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert bf31762b --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 7b725e30
git push origin prod --force-with-lease
```

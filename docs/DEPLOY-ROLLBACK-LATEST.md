# Rollback Plan (auto) — Summa Social

Generat: 2026-03-14 09:42
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: bdd2a9e
SHA main a publicar: 50e57b8

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 50e57b8 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard bdd2a9e
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-03-12 14:39
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 80489ed
SHA main a publicar: 193dfe9

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 193dfe9 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 80489ed
git push origin prod --force-with-lease
```

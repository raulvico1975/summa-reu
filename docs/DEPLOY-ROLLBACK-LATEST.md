# Rollback Plan (auto) — Summa Social

Generat: 2026-03-22 18:08
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 994b5c79
SHA main a publicar: 5cda0421

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 5cda0421 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 994b5c79
git push origin prod --force-with-lease
```

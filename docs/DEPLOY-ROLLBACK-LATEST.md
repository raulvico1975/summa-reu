# Rollback Plan (auto) — Summa Social

Generat: 2026-03-07 18:27
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 989945e
SHA main a publicar: 4499e62

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 4499e62 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 989945e
git push origin prod --force-with-lease
```

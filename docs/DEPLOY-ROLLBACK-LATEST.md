# Rollback Plan (auto) — Summa Social

Generat: 2026-03-22 18:47
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 3b18ac1e
SHA main a publicar: 2b054400

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 2b054400 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 3b18ac1e
git push origin prod --force-with-lease
```

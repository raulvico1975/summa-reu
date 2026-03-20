# Rollback Plan (auto) — Summa Social

Generat: 2026-03-20 12:45
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 5c6a024f
SHA main a publicar: 7981131f

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 7981131f --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 5c6a024f
git push origin prod --force-with-lease
```

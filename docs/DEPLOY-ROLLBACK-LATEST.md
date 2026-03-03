# Rollback Plan (auto) — Summa Social

Generat: 2026-03-03 20:27
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 4a4a1d7
SHA main a publicar: 682d88b

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 682d88b --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 4a4a1d7
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-03-20 09:13
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 137918d
SHA main a publicar: 9f3995e

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 9f3995e --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 137918d
git push origin prod --force-with-lease
```

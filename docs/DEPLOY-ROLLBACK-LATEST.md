# Rollback Plan (auto) — Summa Social

Generat: 2026-03-22 20:22
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 9ce5d7c7
SHA main a publicar: 5a124e5f

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 5a124e5f --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 9ce5d7c7
git push origin prod --force-with-lease
```

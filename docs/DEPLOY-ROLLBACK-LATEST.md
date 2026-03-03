# Rollback Plan (auto) — Summa Social

Generat: 2026-03-03 12:05
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 3eecf53
SHA main a publicar: 28f4777

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 28f4777 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 3eecf53
git push origin prod --force-with-lease
```

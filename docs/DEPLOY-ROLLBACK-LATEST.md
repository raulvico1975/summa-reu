# Rollback Plan (auto) — Summa Social

Generat: 2026-03-22 19:01
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 36674bb8
SHA main a publicar: 3cdb53bc

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 3cdb53bc --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 36674bb8
git push origin prod --force-with-lease
```

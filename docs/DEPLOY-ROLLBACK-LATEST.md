# Rollback Plan (auto) — Summa Social

Generat: 2026-03-05 14:22
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 6d18ecc
SHA main a publicar: 931693d

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 931693d --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 6d18ecc
git push origin prod --force-with-lease
```

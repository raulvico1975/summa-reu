# Rollback Plan (auto) — Summa Social

Generat: 2026-03-22 21:17
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 915b36f9
SHA main a publicar: 9556d7fe

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 9556d7fe --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 915b36f9
git push origin prod --force-with-lease
```

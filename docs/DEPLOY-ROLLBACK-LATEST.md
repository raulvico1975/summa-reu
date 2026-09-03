# Rollback Plan (auto) — Summa Social

Generat: 2026-09-03 18:54
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 540effbd3
SHA branca a publicar (main): a2ee3dd80

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert a2ee3dd80 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 540effbd3
git push origin prod --force-with-lease
```

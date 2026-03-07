# Rollback Plan (auto) — Summa Social

Generat: 2026-03-07 19:21
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 0f4e83f
SHA main a publicar: f0a7c11

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert f0a7c11 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 0f4e83f
git push origin prod --force-with-lease
```

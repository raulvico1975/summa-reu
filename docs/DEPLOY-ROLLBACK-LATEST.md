# Rollback Plan (auto) — Summa Social

Generat: 2026-03-22 17:56
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: dcb29993
SHA main a publicar: 224affa2

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 224affa2 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard dcb29993
git push origin prod --force-with-lease
```

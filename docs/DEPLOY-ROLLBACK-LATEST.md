# Rollback Plan (auto) — Summa Social

Generat: 2026-03-07 18:52
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 213d149
SHA main a publicar: de3506d

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert de3506d --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 213d149
git push origin prod --force-with-lease
```

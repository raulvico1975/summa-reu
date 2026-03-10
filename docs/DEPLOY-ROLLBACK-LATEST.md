# Rollback Plan (auto) — Summa Social

Generat: 2026-03-10 11:01
Risc: BAIX
Backup curt: NO_REQUIRED
SHA prod abans de publicar: d0d075e
SHA main a publicar: 7f10e33

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 7f10e33 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard d0d075e
git push origin prod --force-with-lease
```

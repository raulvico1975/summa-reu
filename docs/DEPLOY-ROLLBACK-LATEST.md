# Rollback Plan (auto) — Summa Social

Generat: 2026-03-19 12:12
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 74dd643
SHA main a publicar: d2a1a48

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert d2a1a48 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 74dd643
git push origin prod --force-with-lease
```

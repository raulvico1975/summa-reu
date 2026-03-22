# Rollback Plan (auto) — Summa Social

Generat: 2026-03-22 19:19
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: ef1a9253
SHA main a publicar: 622fced5

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 622fced5 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard ef1a9253
git push origin prod --force-with-lease
```

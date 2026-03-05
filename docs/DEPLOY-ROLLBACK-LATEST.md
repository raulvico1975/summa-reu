# Rollback Plan (auto) — Summa Social

Generat: 2026-03-05 16:35
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: d5069a8
SHA main a publicar: f7b45ec

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert f7b45ec --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard d5069a8
git push origin prod --force-with-lease
```

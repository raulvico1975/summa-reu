# Rollback Plan (auto) — Summa Social

Generat: 2026-03-02 16:24
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: aa487f6
SHA main a publicar: 77a9213

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 77a9213 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard aa487f6
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-03-08 09:15
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: da256fa
SHA main a publicar: fa28483

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert fa28483 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard da256fa
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-04-29 19:01
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 4a3006e36
SHA branca a publicar (main): 9e1af0593

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 9e1af0593 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 4a3006e36
git push origin prod --force-with-lease
```

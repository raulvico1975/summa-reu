# Rollback Plan (auto) — Summa Social

Generat: 2026-07-27 02:00
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 6f356de5d
SHA branca a publicar (main): d60b8599e

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert d60b8599e --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 6f356de5d
git push origin prod --force-with-lease
```

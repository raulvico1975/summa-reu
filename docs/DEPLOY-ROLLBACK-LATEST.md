# Rollback Plan (auto) — Summa Social

Generat: 2026-08-15 09:17
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: dd11e6026
SHA branca a publicar (main): 8f6860085

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 8f6860085 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard dd11e6026
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-03-26 16:41
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 93456ac4
SHA branca a publicar (main): f4ebb43d

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert f4ebb43d --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 93456ac4
git push origin prod --force-with-lease
```

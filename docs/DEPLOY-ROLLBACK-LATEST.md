# Rollback Plan (auto) — Summa Social

Generat: 2026-08-14 20:20
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 727bb2520
SHA branca a publicar (main): dcefcda32

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert dcefcda32 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 727bb2520
git push origin prod --force-with-lease
```

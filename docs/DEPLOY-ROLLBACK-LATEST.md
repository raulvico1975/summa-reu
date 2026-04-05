# Rollback Plan (auto) — Summa Social

Generat: 2026-04-05 19:03
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 1990aa37
SHA branca a publicar (main): 31c796bd

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 31c796bd --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 1990aa37
git push origin prod --force-with-lease
```

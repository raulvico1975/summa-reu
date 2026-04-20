# Rollback Plan (auto) — Summa Social

Generat: 2026-04-20 09:06
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: e961aca5b
SHA branca a publicar (main): 526e0cc74

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 526e0cc74 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard e961aca5b
git push origin prod --force-with-lease
```

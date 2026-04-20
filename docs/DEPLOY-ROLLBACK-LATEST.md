# Rollback Plan (auto) — Summa Social

Generat: 2026-04-20 09:38
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 3244f6b12
SHA branca a publicar (main): 87124be32

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 87124be32 --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 3244f6b12
git push origin prod --force-with-lease
```

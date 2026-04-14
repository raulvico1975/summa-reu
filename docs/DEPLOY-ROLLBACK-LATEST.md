# Rollback Plan (auto) — Summa Social

Generat: 2026-04-14 17:06
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 1ae0f21a5
SHA branca a publicar (main): f994cee4f

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert f994cee4f --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 1ae0f21a5
git push origin prod --force-with-lease
```

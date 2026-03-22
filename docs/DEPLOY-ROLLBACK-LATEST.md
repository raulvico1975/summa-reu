# Rollback Plan (auto) — Summa Social

Generat: 2026-03-22 22:38
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 3cfc34eb
SHA main a publicar: 3b9a5711

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 3b9a5711 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 3cfc34eb
git push origin prod --force-with-lease
```

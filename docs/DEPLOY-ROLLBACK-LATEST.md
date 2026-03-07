# Rollback Plan (auto) — Summa Social

Generat: 2026-03-07 20:00
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: de214b6
SHA main a publicar: 093c89f

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 093c89f --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard de214b6
git push origin prod --force-with-lease
```

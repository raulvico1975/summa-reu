# Rollback Plan (auto) — Summa Social

Generat: 2026-03-12 08:18
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 36afacf
SHA main a publicar: bfa7c8d

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert bfa7c8d --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 36afacf
git push origin prod --force-with-lease
```

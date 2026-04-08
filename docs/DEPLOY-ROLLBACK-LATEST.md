# Rollback Plan (auto) — Summa Social

Generat: 2026-04-08 17:02
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 51dae3d3
SHA branca a publicar (codex/i18n-movements-load-prodfix): 93cec7c8

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout codex/i18n-movements-load-prodfix
git revert 93cec7c8 --no-edit
git push origin codex/i18n-movements-load-prodfix
bash scripts/deploy.sh codex/i18n-movements-load-prodfix
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 51dae3d3
git push origin prod --force-with-lease
```

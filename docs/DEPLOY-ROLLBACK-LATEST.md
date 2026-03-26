# Rollback Plan (auto) — Summa Social

Generat: 2026-03-26 10:33
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: fe2a84ce
SHA branca a publicar (main): 951cae6b

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 951cae6b --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard fe2a84ce
git push origin prod --force-with-lease
```

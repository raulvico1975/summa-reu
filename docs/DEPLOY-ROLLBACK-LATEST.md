# Rollback Plan (auto) — Summa Social

Generat: 2026-09-04 08:20
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 2a17650c2
SHA branca a publicar (main): 27de354be

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 27de354be --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 2a17650c2
git push origin prod --force-with-lease
```

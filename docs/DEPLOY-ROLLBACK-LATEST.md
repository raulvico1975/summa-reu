# Rollback Plan (auto) — Summa Social

Generat: 2026-03-28 19:25
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: bb0728ef
SHA branca a publicar (main): e0bae22d

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert e0bae22d --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard bb0728ef
git push origin prod --force-with-lease
```

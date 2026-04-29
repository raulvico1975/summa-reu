# Rollback Plan (auto) — Summa Social

Generat: 2026-04-29 09:41
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 3f361933a
SHA branca a publicar (main): e86b6317c

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert e86b6317c --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 3f361933a
git push origin prod --force-with-lease
```

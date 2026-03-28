# Rollback Plan (auto) — Summa Social

Generat: 2026-03-28 11:42
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 0eb1449e
SHA branca a publicar (codex/blog-404-removal-fix-20260328): 7a28df1d

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout codex/blog-404-removal-fix-20260328
git revert 7a28df1d --no-edit
git push origin codex/blog-404-removal-fix-20260328
bash scripts/deploy.sh codex/blog-404-removal-fix-20260328
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 0eb1449e
git push origin prod --force-with-lease
```

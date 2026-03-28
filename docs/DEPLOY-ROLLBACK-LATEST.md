# Rollback Plan (auto) — Summa Social

Generat: 2026-03-28 12:04
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: ab8b9223
SHA branca a publicar (codex/blog-404-removal-fix-20260328): 572f640c

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout codex/blog-404-removal-fix-20260328
git revert 572f640c --no-edit
git push origin codex/blog-404-removal-fix-20260328
bash scripts/deploy.sh codex/blog-404-removal-fix-20260328
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard ab8b9223
git push origin prod --force-with-lease
```

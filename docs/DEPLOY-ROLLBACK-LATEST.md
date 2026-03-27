# Rollback Plan (auto) — Summa Social

Generat: 2026-03-27 15:37
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: 6b045417
SHA branca a publicar (codex/blog-bilingual-locale): bdf26fba

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout codex/blog-bilingual-locale
git revert bdf26fba --no-edit
git push origin codex/blog-bilingual-locale
bash scripts/deploy.sh codex/blog-bilingual-locale
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 6b045417
git push origin prod --force-with-lease
```

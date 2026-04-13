# Rollback Plan (auto) — Summa Social

Generat: 2026-04-13 20:15
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: ff8fa0e91
SHA branca a publicar (codex/growth-mvp): f2e5c6cb7

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout codex/growth-mvp
git revert f2e5c6cb7 --no-edit
git push origin codex/growth-mvp
bash scripts/deploy.sh codex/growth-mvp
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard ff8fa0e91
git push origin prod --force-with-lease
```

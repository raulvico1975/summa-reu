# Rollback Plan (auto) — Summa Social

Generat: 2026-03-30 18:47
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: a3d1ef5f
SHA branca a publicar (codex/release-moviments-air-badges-20260330): 9275f743

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout codex/release-moviments-air-badges-20260330
git revert 9275f743 --no-edit
git push origin codex/release-moviments-air-badges-20260330
bash scripts/deploy.sh codex/release-moviments-air-badges-20260330
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard a3d1ef5f
git push origin prod --force-with-lease
```

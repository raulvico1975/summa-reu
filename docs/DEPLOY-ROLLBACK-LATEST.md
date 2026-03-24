# Rollback Plan (auto) — Summa Social

Generat: 2026-03-24 09:58
Risc: ALT
Backup curt: SKIPPED_NO_BUCKET
SHA prod abans de publicar: 8306930a
SHA branca a publicar (codex/release-2-api-20260324): 2187fce3

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout codex/release-2-api-20260324
git revert 2187fce3 --no-edit
git push origin codex/release-2-api-20260324
bash scripts/deploy.sh codex/release-2-api-20260324
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard 8306930a
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-04-02 14:44
Risc: MITJA
Backup curt: NO_REQUIRED
SHA prod abans de publicar: a6b10c82
SHA branca a publicar (main): 8819052d

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert 8819052d --no-edit
git push origin main
bash scripts/deploy.sh main
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard a6b10c82
git push origin prod --force-with-lease
```

# Rollback Plan (auto) — Summa Social

Generat: 2026-03-02 17:46
Risc: ALT
Backup curt: NO_REQUIRED
SHA prod abans de publicar: f7881d1
SHA main a publicar: e84cd15

## Si cal marxa enrere rapida

Opcio recomanada (preserva historial):
```bash
git checkout main
git revert e84cd15 --no-edit
git push origin main
bash scripts/deploy.sh
```

Emergencia critica (nomes si la produccio cau i no hi ha alternativa):
```bash
git checkout prod
git reset --hard f7881d1
git push origin prod --force-with-lease
```

## Publicacio Help -> Guies (obligatori abans de deploy)

1. `npm run help:build-guides-adapter`
2. `npm run i18n:check && npm run i18n:validate-guides`
3. Publicar `guides.*` a Storage via flux SuperAdmin (si hi ha override actiu en produccio).
4. Verificar divergencia Storage/local amb auditoria:
   - `HELP_AUDIT_STORAGE=1 npm run help:audit`
   - Revisar la seccio `Divergencia Storage` de `help/audit-report.md`.

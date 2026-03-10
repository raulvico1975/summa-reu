# Deploy Incidents — Summa Social

Registre curt d'incidències de deploy bloquejat o incomplet.

| Data | Fase | Risc | main | prod | Resultat | Què ha fallat | Com s'ha resolt |
|------|------|------|------|------|----------|---------------|------------------|
| 2026-02-15 12:14 | Preflight git | BAIX | 27f96f5 | 1205c8f | BLOCKED_SAFE | Hi ha canvis pendents sense tancar abans de publicar. | Pendent |
| 2026-02-15 17:40 | Preflight git | BAIX | 0fe836e | 216c355 | BLOCKED_SAFE | Hi ha canvis pendents sense tancar abans de publicar. | Pendent |
| 2026-02-15 23:24 | Preflight git | BAIX | f9fdeb4 | 0a404c8 | BLOCKED_SAFE | Hi ha canvis pendents sense tancar abans de publicar. | Pendent |
| 2026-02-15 23:24 | Preflight git | BAIX | 92fcdca | 0a404c8 | BLOCKED_SAFE | Hi ha canvis pendents sense tancar abans de publicar. | Pendent |
| 2026-02-16 13:02 | Verificacions | MITJA | 565dc3a | 397ca22 | BLOCKED_SAFE | La verificacio local no ha passat. | Pendent |
| 2026-02-16 13:02 | Preflight git | BAIX | 565dc3a | 397ca22 | BLOCKED_SAFE | Hi ha canvis pendents sense tancar abans de publicar. | Pendent |
| 2026-02-16 13:04 | Verificacions | MITJA | 3e84bd9 | 397ca22 | BLOCKED_SAFE | La verificacio de CI no ha passat. | Pendent |
| 2026-02-17 22:34 | Preflight git | BAIX | b2e1afe | 85892a1 | BLOCKED_SAFE | Main no esta sincronitzada amb remot. | Pendent |
| 2026-02-24 19:40 | Resum predeploy | ALT | 9e7f12f | 0d83b87 | BLOCKED_SAFE | Comprovacio no superada a la fase: Resum predeploy | Pendent |
| 2026-02-26 09:18 | Verificacions | MITJA | a0b9cb2 | e49cc44 | BLOCKED_SAFE | La verificacio de CI no ha passat. | Pendent |
| 2026-02-26 10:15 | Verificacions | MITJA | 83ac439 | df80f45 | BLOCKED_SAFE | La verificacio de CI no ha passat. | Pendent |
| 2026-02-28 18:06 | Preflight git | BAIX | f96712d | aa7407f | BLOCKED_SAFE | Comprovacio no superada a la fase: Preflight git | Pendent |
| 2026-02-28 18:08 | Resum predeploy | ALT | 4a379c8 | aa7407f | BLOCKED_SAFE | Comprovacio no superada a la fase: Resum predeploy | Pendent |
| 2026-02-28 19:01 | Preflight git | BAIX | fa0bfbc | 885ab58 | BLOCKED_SAFE | Hi ha canvis pendents sense tancar abans de publicar. | Pendent |
| 2026-02-28 19:01 | Preflight git | BAIX | dc0587d | 885ab58 | BLOCKED_SAFE | Hi ha canvis pendents sense tancar abans de publicar. | Pendent |
| 2026-02-28 19:34 | Verificacions | ALT | d0291b3 | 2e5ef88 | BLOCKED_SAFE | La verificacio de CI no ha passat. | Pendent |
| 2026-03-03 16:50 | Preflight git | BAIX | 840a1e9 | 071108e | BLOCKED_SAFE | El deploy nomes es pot fer des de main. | Pendent |
| 2026-03-03 20:15 | Preflight git | BAIX | 840a1e9 | 071108e | BLOCKED_SAFE | El deploy nomes es pot fer des de main. | Pendent |
| 2026-03-03 20:18 | Preflight git | BAIX | 840a1e9 | 72e885d | BLOCKED_SAFE | El deploy nomes es pot fer des de main. | Pendent |
| 2026-03-08 09:04 | Preflight git | BAIX | ec3f157 | da256fa | BLOCKED_SAFE | Hi ha canvis pendents sense tancar abans de publicar. | Pendent |

## 2026-03-08 — Deploy verd amb HTML antic durant una finestra curta

- Què va passar: el deploy a `prod` va acabar en verd, però durant una finestra curta `/ca`, `/ca/contact` i `/ca/gestio-economica-ong` encara servien HTML antic.
- Símptoma: resposta `200` amb `x-nextjs-cache: HIT` i `x-nextjs-prerender: 1`, mentre el contingut servit no coincidia encara amb el commit acabat de publicar.
- Causa probable: propagació de revisió/prerender a origen a App Hosting; no era un problema de ruta ni de CDN edge.
- Resolució: el contingut es va estabilitzar sol sense redeploy i després va servir el copy/metadades esperats.

## 2026-03-10 — Rollout d'App Hosting desalineat en fix critic d'invitacions

- PR afectada: `#17`
- Commit funcional: `f37c5c6` (`fix(invitations): harden invited auth flow`)
- Commit operatiu de rollout: `d73d1dc` (`ops(deploy): force app hosting rollout`)
- Incidencia: App Hosting servia una revisio anterior tot i que `prod` ja contenia el fix; el comportament real de `/api/invitations/accept` continuava consumint invitacions de `already_member`.
- Resolucio: push d'un commit buit operatiu a `prod` per forcar un nou rollout i revalidacio directa de l'endpoint i dels fluxos d'usuari.
- Verificacio final en produccio:
  - registre amb invitacio nova: OK
  - login normal sense invitacio: OK
  - token invalid: OK
  - `already_member`: OK, no consumeix invitacio, no deixa entrada incoherent al dashboard i no queden comptes parcials
- Estat final: `resolt`, `desplegat`, `verificat en produccio`
- Estat de seguiment intern: `tancat`
- Criteri de reobertura: nomes si apareix un cas funcional nou diferent o una regressio detectada en produccio

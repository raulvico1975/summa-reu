# Topologia Local de Repos

Document curt per evitar el problema recurrent de "no sé quin repo és el bo".

## 1. Repos canònics

Només aquests directoris són font de veritat operativa:

- `/Users/raulvico/Documents/summa-social`
- `/Users/raulvico/Documents/summa-board`

Excepció explícita:

- `/Users/raulvico/Documents/summa-board-mirror`
  Aquest repo és un mirror separat. No és el repo de treball de producte.

## 2. Què NO és font de veritat

Qualsevol carpeta com aquestes s'ha de considerar temporal, d'arxiu o de suport:

- `summa-social-control-*`
- `summa-social-release-*`
- `summa-social-deploy-run-*`
- `summa-board-main`
- `summa-board-worktrees`
- `summa-social-worktrees*`

Regla pràctica:

- si apunta al mateix `origin` que el repo canònic, però no és el directori canònic, és una còpia o snapshot
- no s'hi integra
- no s'hi publica
- no s'hi fa diagnòstic de "què està realment a prod"

## 3. Ordre mínima abans de tocar prod

Per `summa-social`:

```bash
cd /Users/raulvico/Documents/summa-social
npm run repos:audit
npm run status
npm run worktree:list
```

Per `summa-board`:

- comprovar que el directori de treball és `/Users/raulvico/Documents/summa-board`
- comprovar branca i estat amb `git status --short --branch`
- si hi ha mirror o snapshots, no prendre'ls com a referència de deploy

## 4. Senyals de desordre real

- el repo canònic no és net
- hi ha una còpia duplicada amb canvis locals
- `prod` va per darrere de `main`
- hi ha més d'un directori que sembla "el bo"
- hi ha snapshots vells al mateix nivell que el repo canònic

## 5. Política d'arxiu

Quan una còpia ja no és necessària:

1. verificar si té canvis locals
2. si no en té, moure-la fora del nivell principal de `Documents`
3. usar una carpeta d'arxiu clara, per exemple:

```text
/Users/raulvico/Documents/_archive_summa/
```

No deixar snapshots i repos canònics barrejats al mateix nivell durant setmanes.

## 6. Regla d'autoritat

Si hi ha conflicte entre carpetes, l'autoritat és:

1. repo canònic
2. branca estable (`main` i, si aplica, `prod`)
3. estat remot (`origin/main`, `origin/prod`)
4. logs i ritual de deploy

No s'ha d'inferir l'estat real de producció des d'una còpia local antiga.

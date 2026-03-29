# Design Docs

Aquest directori conté normes de disseny curtes, no una documentació extensa de branding.

## Ordre de lectura

1. `00-design-contract.md` - contracte general de percepció i coherència
2. `01-color-system.md` - mapping semàntic tancat de color
3. `03-data-interfaces.md` - patró de taules i llistats
4. `06-no-horizontal-scroll.md` - guardrail normatiu de layout
5. `04-ui-readiness.md` - checklist ràpid abans de tancar un canvi UI
6. `07-admin-panel-non-technical-proposal.md` - proposta de simplificació del panell d'admin per a un únic usuari no tècnic

## Criteri d'ús

- si el canvi toca color, començar per `01-color-system.md`
- si toca taules, llistats o densitat de dades, mirar `03-data-interfaces.md`
- si toca responsive o taules mòbils, revisar `06-no-horizontal-scroll.md`
- si només vols validar el canvi abans de commit, usar `04-ui-readiness.md`

## Abast

Aquests documents són vigents mentre no contradiguin el sistema existent.

No són una invitació a redissenyar l'app: serveixen per mantenir coherència i evitar regressions visuals.

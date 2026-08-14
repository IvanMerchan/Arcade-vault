# Bitácora de sugerencias de juegos

Historial de rondas del agente `game-planner` (`.claude/agents/game-planner.md`). Cada ronda es una sección nueva, con fecha real (`date +%F`) y el ranking completo evaluado ese día. **No se borran rondas anteriores** — es una bitácora, no un snapshot; el ranking vigente vive en `references/game-suggestions-todo.md`.

Estados posibles por candidato: `Propuesto` (evaluado, sin decisión) · `Aceptado` (se decidió avanzar, pendiente de spec) · `Descartado` (se decidió no avanzar, con motivo) · `Implementado` (ya tiene componente jugable real).

---

## Historial previo a este agente (reconstruido de `specs/`)

Estas dos decisiones ya ocurrieron, sin haber pasado por `game-planner` — se registran aquí para que el agente no las vuelva a proponer.

| Candidato    | Fuente                                  | Categoría | Estado         | Spec                          |
| ------------ | ---------------------------------------- | --------- | -------------- | ------------------------------ |
| `asteroides` | `references/started-games/02-asteroids`  | SHOOTER   | `Implementado` | `specs/04-rocas-asteroids-real.md` |
| `caida`      | `references/started-games/03-tetris`     | PUZZLE    | `Implementado` | `specs/07-caida-tetris-real.md`    |

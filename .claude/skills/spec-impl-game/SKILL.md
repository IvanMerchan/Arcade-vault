---
name: spec-impl-game
description: Implementa un spec de juego de punta a punta — corre /spec-impl y, al terminar, encadena los subagentes skin-designer y luego mobile-porter, uno después del otro. Úsalo en vez de /spec-impl cuando el spec añade o cambia un juego jugable.
disable-model-invocation: true
argument-hint: "<NN-spec-name>"
---

# /spec-impl-game — Implementa un spec de juego y remata skins + mobile

## Nota sobre `allowed-tools`

Este skill deliberadamente **no** declara `allowed-tools`. Es un wrapper alrededor de `/spec-impl` (que necesita `Edit`, `Write`, y varios `Bash(git ...)`) más las tools `Skill` y `Agent` para encadenar los subagentes. Declarar una lista aquí correría el riesgo de estrangular la fase envuelta si `/spec-impl` cambia sus propias tools en una actualización futura. No la agregues "para ser explícito" — es intencional.

---

Este skill no reemplaza a `/spec-impl`: lo envuelve. Implementa el spec exactamente igual, paso a paso, con las mismas pausas y el mismo bloqueo de estado. La única diferencia es lo que pasa **después** de que el último paso del plan queda implementado: en vez de terminar ahí, encadena dos subagentes que ya existen en este repo — `skin-designer` y `mobile-porter` — para que un juego nuevo no quede a medio vestir (una sola skin, sin pasada de mobile).

## Filosofía

`skin-designer` y `mobile-porter` existen precisamente para este momento — "acabo de implementar un juego" — pero hay que acordarse de invocarlos a mano, en el orden correcto, con el target correcto. Este skill es solo ese pegamento. No escribe código de juego ni de skins ni de layout por sí mismo: todo el código lo escriben `/spec-impl` (mecánica del juego) y los dos subagentes (skins, mobile). Este skill orquesta y confirma.

## Command flow

Sigue las fases en orden. No te saltes la Fase 0 — es lo que le permite a este comando encontrar specs anidados (`specs/frogger/`, `specs/game-jam/<id>/`) que `/spec-impl` por sí solo no ve.

### Fase 0 — Resolver la ruta del spec

`/spec-impl` busca el spec con un `ls specs/` plano, así que no encuentra specs en subcarpetas. Antes de delegar:

1. `Glob("specs/**/*.md")` — incluye anidados.
2. Si `$ARGUMENTS` viene vacío: muestra la lista completa (raíz + anidados) y pregunta cuál implementar. Espera la respuesta, no continúes.
3. Si `$ARGUMENTS` tiene valor: intenta resolverlo contra los resultados del glob igual que `/spec-impl` intentaría (nombre completo, solo número, solo slug). Si hay más de un archivo que matchea, desambigua con `AskUserQuestion` mostrando las rutas completas.
4. Con la ruta resuelta (p. ej. `specs/game-jam/ranaria/02-integracion.md`), pásasela a `/spec-impl` como su argumento en la Fase 1 — así su propia Fase 1 la encuentra directo sin tener que adivinar.

### Fase 1 — Delegar en `/spec-impl`

Invoca la skill `spec-impl` (tool `Skill`, `skill: "spec-impl"`, `args:` la ruta resuelta en la Fase 0) y sigue sus 4 fases **al pie de la letra, sin atajos ni resúmenes**:

- Validación de estado (`Aprobado`/`Approved`/equivalente) — si no se cumple, la cadena entera se corta ahí. **No se lanza ningún subagente.**
- Creación/checkout de la rama `spec-NN-slug`.
- Implementación paso a paso, con pausa y confirmación explícita del usuario entre cada paso del plan.
- Nunca commitear automáticamente — eso sigue siendo decisión del usuario.

Si `/spec-impl` se detiene por cualquier motivo (estado no aprobado, working tree sucio, ambigüedad sin resolver), este skill se detiene ahí también. No hay Fase 2 en adelante sin que `/spec-impl` haya completado su Fase 4.

### Fase 2 — Puente

Una vez que el último paso del plan está implementado y `/spec-impl` mostró su cierre habitual:

1. Determina el `game-id` afectado: lee la ficha de catálogo / `## Data model` del spec, y contrástalo con `lib/game-registry.ts` (¿aparece en `isPlayable()`? ¿hay un `components/<Nombre>Game.tsx` nuevo o tocado?).
2. Si el spec **no** produjo ni tocó un componente jugable real, dilo explícitamente y **salta la Fase 3** — `skin-designer` no tiene sobre qué trabajar sin un componente de dibujo. Ve directo a la Fase 4.
3. Muestra un resumen corto antes de seguir: spec implementado, rama activa, `game-id` detectado, archivos de juego tocados.

### Fase 3 — skin-designer

Si la Fase 2 no te mandó a saltarla:

1. Pregunta explícitamente: `¿Lanzo skin-designer para <game-id>?` — espera un sí claro.
2. Si el usuario dice que no, anótalo y pasa a la Fase 4 sin insistir.
3. Con el OK: una sola llamada `Agent` con `subagent_type: "skin-designer"`. El prompt debe **nombrar el `game-id` explícitamente** (p. ej. "audita e implementa las skins faltantes para `caida`") — nunca lo dejes ambiguo ni le pidas "todos los juegos"; el agente exige un target único por corrida.
4. Cuando vuelva, relata en tus palabras qué hizo (su reporte final no lo ve el usuario directamente) y muestra que hay un diff nuevo para revisar.

### Fase 4 — mobile-porter

1. `AskUserQuestion` con las rutas válidas de `mobile-porter`: `/juegos/[id]`, `/biblioteca`, `/salon`, `/`, `/auth`. Recomienda `/juegos/[id]` primero si el spec agregó o cambió una ficha de catálogo (es la ruta que más probablemente cambió). **Nunca ofrezcas `/jugar/[id]`** — `mobile-porter` tiene prohibido tocarla, ya la cubrió SPEC 08.
2. Con la ruta elegida: una sola llamada `Agent` con `subagent_type: "mobile-porter"`, nombrando esa única ruta explícitamente en el prompt.
3. Relata el resultado igual que en la Fase 3.

### Cierre

Recuerda al usuario:

- Verificar uno por uno los criterios de aceptación del spec original.
- Correr `npm run lint` y `npm run build` sobre el estado final (código de juego + skins + mobile).
- Que el commit, el push, y el cambio de estado del spec a `Implementado` son decisión suya — este skill nunca los hace por su cuenta.

## Hard rules

- Los dos subagentes corren **en serie, nunca en paralelo** — ambos pueden tocar `components/*Game.tsx` y `app/globals.css`; correrlos a la vez arriesga un conflicto de edición.
- Un target explícito por subagente: **un** `game-id` para `skin-designer`, **una** ruta para `mobile-porter`. Nunca "todos los juegos" ni "todas las rutas" en una sola pasada — ninguno de los dos agentes lo permite.
- Si `/spec-impl` se corta en cualquiera de sus 4 fases, la cadena entera se corta ahí — no se ofrece lanzar los subagentes "de todos modos".
- Nunca commitear ni mergear en ninguna fase; nunca cambiar el estado del spec a `Implementado` por cuenta propia.
- Nunca editar `.claude/skills/spec-impl/` ni `.claude/skills/spec/` — son symlinks pinneados a `.agents/skills/` vía `skills-lock.json`. Este skill los envuelve, no los toca.
- Nunca añadir este skill a `skills-lock.json` — es local, igual que `add-game`; el lockfile es solo para lo instalado desde fuentes externas.
- Resuelve siempre el spec con `Glob("specs/**/*.md")` en la Fase 0, nunca asumas que vive en la raíz plana de `specs/`.

## Arguments

`$ARGUMENTS` es el mismo argumento que recibiría `/spec-impl`: el nombre completo del spec, solo su número, o solo su slug (p. ej. `08`, `controles-tactiles-movil`, `frogger/01-frogger-core`). Si viene vacío, la Fase 0 lista los specs disponibles (incluidos los anidados) y pregunta.

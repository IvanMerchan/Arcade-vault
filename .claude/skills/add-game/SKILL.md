---
name: add-game
description: Diseña el spec para añadir un juego real jugable con su leaderboard a Arcade Vault. Pregunta por la fuente (references/started-games o desde cero), mecánica, puntuación y ficha de catálogo, y escribe specs/NN-slug.md. No escribe código.
disable-model-invocation: true
argument-hint: "<nombre del juego, id de catálogo, o carpeta de references/started-games>"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), mcp__supabase__list_tables
---

# /add-game — Spec para un juego real + su leaderboard

## Session context

Fecha de hoy (úsala para el header del spec, nunca la adivines):
!`date +%F`

Specs existentes (para calcular el siguiente número):
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe todavía"`

Fuentes de referencia disponibles para portar:
!`ls references/started-games/ 2>/dev/null || echo "references/started-games/ no existe"`

Componentes de juego ya implementados:
!`ls components/*Game.tsx 2>/dev/null || echo "Ningún juego real implementado todavía"`

Migraciones existentes (para calcular el siguiente número de migración):
!`ls supabase/migrations/ 2>/dev/null || echo "supabase/migrations/ no existe"`

Estado del registro de juegos jugables:
!`ls lib/game-registry.ts 2>/dev/null || echo "NO EXISTE — el spec debe incluir el paso de crearlo"`

---

Este skill diseña el spec para conectar un juego real (con su propio loop, controles y puntuación) a Arcade Vault, aprovechando el leaderboard que ya existe. **No escribes código aquí.** Tu trabajo es identificar la fuente del juego, hacer las preguntas necesarias, y dejar `specs/NN-slug.md` listo para que `/spec-impl` lo ejecute.

## Filosofía

El leaderboard (guardar puntuación, tabla `/juegos/[id]`, Salón de la Fama `/salon`) **ya es genérico sobre `game_id`** — SPEC 06 lo dejó así. Lo único específico de un juego nuevo es: su ficha de catálogo, su componente de juego, y (la primera vez) el registro que conecta ambos. Este skill existe para que esa distinción quede clara en cada spec que produzca, en vez de reinventarse juego a juego.

Antes de seguir, lee `porting-guide.md` (en esta misma carpeta) — es la referencia técnica que este skill usa en cada fase: el contrato del componente, el código del registro, la plantilla de migración y el checklist de 7 puntos.

## Command flow

Sigue las fases en orden. No saltes la Fase 3 — las preguntas son las que evitan inventar decisiones. Responde siempre en el idioma del prompt inicial del usuario.

### Fase 1 — Contexto

1. Lee, en este orden: `CLAUDE.md` → `.agents/skills/spec/SKILL.md` (convenciones de cómo preguntar y escribir un spec) → `.agents/skills/spec/template.md` (la forma canónica de un spec) → los dos specs más recientes listados en el session context → `porting-guide.md`.
2. Del listado de `supabase/migrations/`, calcula el siguiente número `000N` disponible (puede no usarse, ver Fase 2).
3. Del listado de `specs/`, calcula el siguiente número `NN` para el nuevo spec.
4. Del check de `lib/game-registry.ts` en el session context, decide ya si el plan deberá **crear el registro** (primera vez) o **añadir una línea** (ya existe).

### Fase 2 — Identificar el juego y su fuente

Determina en cuál de estas tres situaciones estás:

| Situación                                   | Cómo se detecta                                                                                    | Qué hacer                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Porte desde `references/started-games/`** | Existe una carpeta `NN-<nombre>/` con archivos (no vacía) que coincide con lo que pidió el usuario | Lee `game.js` **completo**. Inventaría clases, estado global (`let ship, bullets, …`), tabla de puntos por evento, controles de teclado, y las funciones de ciclo de vida (`init`, `update`, `draw`, loop). Si hay `README.md`, compáralo con el código: si contradice, **gana el código** — la discrepancia se documenta en _Out of scope_ del spec (es lo que pasó en SPEC 04 con power-ups y "estrella fugaz" que el README menciona pero `game.js` no implementa) |
| **Desde cero**                              | No hay carpeta fuente para ese juego, o el usuario dice explícitamente que no viene de ahí         | Pasa directo a la Fase 3 y pregunta mecánica, controles, condición de fin y tabla de puntos hasta poder escribir criterios de aceptación booleanos                                                                                                                                                                                                                                                                                                                    |
| **Fuente externa**                          | El usuario pega código o da una ruta fuera de `references/started-games/`                          | Trátalo igual que un porte: léelo completo antes de preguntar nada                                                                                                                                                                                                                                                                                                                                                                                                    |

En paralelo, comprueba si el `id` de catálogo que se está usando ya existe en el catálogo sembrado (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `asteroides`, `ranaria`, `duelo-pixel` — confírmalo leyendo `supabase/migrations/0002_seed_games.sql` si existe, no confíes solo en esta lista):

- **Ya existe** → el plan no lleva migración de `games` ni CSS de portada nuevo; solo el componente de juego y (si aplica) el registro.
- **Es nuevo** → el plan lleva `INSERT` en una migración nueva y una clase `.cover-<slug>`.

Si además `components/<Nombre>Game.tsx` ya existe para ese juego (revisa el listado del session context), dilo explícitamente al usuario — probablemente no hace falta un spec nuevo, o el spec es solo para el registro.

### Fase 3 — Preguntas

Usa `AskUserQuestion` en bloques de 3 a 5, con tu recomendación primero y marcada. Cubre estas categorías (adapta según si es porte o desde cero — en un porte, muchas respuestas ya están en el código y solo hace falta confirmarlas, no re-preguntarlas):

1. **Ficha de catálogo:** `id`, `title`, `short`, `long`, `cat` (`ARCADE|PUZZLE|SHOOTER|VERSUS`), `color` (`cyan|magenta|yellow|green`), `cover`, `sort_order`.
2. **Semántica del HUD:** qué significan `score`, `lives` y `level` en este juego concreto. El HUD de `PlayerScreen` siempre muestra los tres; si el juego no tiene vidas o niveles, hay que decidir qué valor se envía (p. ej. `lives: 1` fijo hasta el game over).
3. **Controles**, y si alguna tecla usada por el juego choca con el input "TUS INICIALES" del modal de fin de partida (las flechas mueven el cursor del input; `running=false` ya desmonta los listeners del juego, pero confírmalo con el usuario para este juego en particular).
4. **Tabla de puntos por evento** — debe ser lo bastante concreta para un criterio booleano ("romper un ladrillo suma exactamente 10 puntos"), no una descripción vaga.
5. **Qué se difiere:** audio, controles táctiles, power-ups u otras features mencionadas en un README pero no en el código fuente. (Si estás portando desde `04-arkanoid`, ten en cuenta que existe una carpeta `assets/sounds/` — el audio pasa a ser una decisión explícita, no un descuido.)

**Cuándo parar de preguntar:** cuando puedas responder sin inventar nada: qué archivos van a aparecer o cambiar, cuál es el primer y el último paso ejecutable, y cómo se verifica que el juego terminó de implementarse.

### Fase 4 — Resumen antes de escribir

Muestra una tabla con: id, título, categoría, color, cover, sort_order, fuente (porte de X / desde cero), controles, tabla de puntuación, y si el spec incluye migración/CSS/registro nuevo o no. Pide confirmación antes de escribir el archivo.

### Fase 5 — Escribir `specs/NN-<slug>.md`

- **Numeración:** el máximo existente en `specs/` más uno.
- **Fecha:** únicamente la que salió en el session context — nunca la inventes.
- **Estado:** `Borrador` (este repo usa el set de estados en español).
- **Depends on:** `SPEC 04, SPEC 05, SPEC 06` (más cualquier otro spec relevante que detectes).
- **Secciones, en este orden exacto** (encabezados en inglés, cuerpo en español — es la convención de los 6 specs existentes):

  `## Por qué este spec` · `## Scope` (con **In:** / **Out of scope (for future specs):**) · `## Data model` · `## Implementation plan` · `## Acceptance criteria` · `## Decisions` · `## Risks` · `## What is **not** in this spec`

- El `## Implementation plan` sigue el checklist de 7 puntos de `porting-guide.md`, omitiendo los pasos que no aplican (migración/CSS si el `id` ya existe, registro si ya existe) y dividiendo cualquier paso de más de 30-50 líneas.
- `## Scope` → **Out of scope** debe decir explícitamente que el leaderboard (guardar puntuación, `/juegos/[id]`, `/salon`) no requiere código nuevo — es la aclaración central de este skill.
- Cierra el documento con la línea literal: _"Cada uno de estos, si se implementa, va en su propio spec."_
- Si es la primera vez que se crea `lib/game-registry.ts`, el `## Decisions` debe incluir por qué se usan imports estáticos y no `next/dynamic` (ver `porting-guide.md`).

### Fase 6 — Confirmar y parar

Anuncia la ruta del archivo creado, recuerda que está en `Borrador` (pasa a `Aprobado` cuando el usuario lo revise), e indica que el siguiente paso es `/spec-impl NN-slug`. **No propongas implementarlo ni escribas código** — tu turno termina aquí.

## Hard rules

- Nunca escribas código de la app en este skill. Solo el `.md` del spec.
- **El leaderboard no requiere código nuevo.** `lib/queries.ts` (`getTopScores`, `getAllTopScores`), `app/juegos/[id]/page.tsx`, `components/HallOfFame.tsx` y `SessionProvider.saveScore` ya son genéricos sobre `game_id`. Nunca especifiques un leaderboard por juego.
- Nunca reintroduzcas un array `GAMES` hardcodeado en `lib/games.ts` — SPEC 05 lo eliminó a propósito; la tabla `games` es la única fuente de verdad.
- Nunca añadas columnas `best`/`plays` a ninguna tabla — solo existen como la vista `game_stats`.
- Toda alta de juego pasa por un archivo versionado en `supabase/migrations/` **y** se aplica también con `apply_migration` del MCP de Supabase. Nunca solo por MCP sin el archivo en el repo — se perdería el historial en git.
- El componente de juego no dibuja su propio HUD ni su propio overlay de game over — esa UI es responsabilidad de `PlayerScreen`.
- El estado del juego vive en `useRef`, nunca en `useState`; los callbacks `onStats`/`onGameOver` se disparan solo cuando el valor cambia, nunca en cada frame.
- Resolución interna fija en proporción 4:3 (800×600, igual que `references/started-games/02-asteroids`) — `.crt-screen` ya usa `aspect-ratio: 4/3`.
- Ningún paso del plan de implementación supera 30-50 líneas de código; si lo hace, se divide.
- No hay test runner configurado: los criterios de aceptación siempre cierran con `npm run lint` y `npm run build` sin errores, más un recorrido manual.
- Ante cualquier ambigüedad, para y ofrece 2-3 opciones concretas — no asumas.

## Arguments

`$ARGUMENTS` es el nombre o id del juego a añadir (p. ej. `caida`, `arkanoid`, o una carpeta como `03-tetris`). Si viene vacío, pregunta primero qué juego se quiere añadir y si tiene una fuente en `references/started-games/`.

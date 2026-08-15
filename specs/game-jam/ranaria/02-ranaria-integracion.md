# SPEC 02 — Conectar RANARIA al registro de juegos y a `PlayerScreen`

> **Status:** Borrador
> **Depends on:** SPEC 01
> **Date:** 2026-08-14
> **Objective:** Reemplazar el arena mock de `PlayerScreen` por `RanariaGame` (SPEC 01) para el `id` `ranaria`, sin ninguna migración de Supabase ni CSS nuevo porque la ficha de catálogo y su portada ya existen.

---

## Por qué este spec

Verificado en vivo antes de escribir este spec (no solo contra documentación, que en este punto está desactualizada respecto al código real):

- `lib/game-registry.ts` hoy **no** tiene un mapa `id → componente` (`getPlayableGame`) como describe `.claude/skills/add-game/porting-guide.md` §4 — esa es la forma planeada, no la implementada. La forma real es más simple: `const PLAYABLE_GAME_IDS = new Set(["asteroides", "caida"]); export function isPlayable(id: string): boolean`.
- `components/PlayerScreen.tsx` tampoco usa ese registro para elegir el componente a renderizar: usa una cadena de comparaciones directas — `game.id === "asteroides" ? <AsteroidsGame .../> : game.id === "caida" ? <TetrisGame .../> : <div className="game-arena">...</div>`. `isPlayable(game.id)` solo se usa para decidir si el HUD toma `score`/`level` de `onStats` real o del ticker mock (`useEffect` de la línea ~31).
- La fila `ranaria` en `games` ya existe (`ARCADE`, `green`, `cover: "cover-rana"`, `sort_order 6`) — confirmado por consulta directa a Supabase en la Fase 1 de esta jam, sin diferencias con lo que ya está sembrado.
- La clase `.cover-rana` ya existe en `app/globals.css:491` y coincide exactamente con el valor de `cover` de la fila — no `.cover-ranaria`, que sería el nombre por defecto si se generara desde el `id`.

Este spec sigue la forma **real** del código, no la forma aspiracional del porting-guide: añade `"ranaria"` al `Set` existente y un branch nuevo a la cadena de comparaciones existente, en vez de crear un mapa `getPlayableGame` que no existe hoy en el repo.

---

## Scope

**In:**

- `lib/game-registry.ts`: añadir `"ranaria"` a `PLAYABLE_GAME_IDS` (`new Set(["asteroides", "caida", "ranaria"])`). Ningún otro cambio a este archivo.
- `components/PlayerScreen.tsx`: añadir `import { RanariaGame } from "@/components/RanariaGame";`, y extender la cadena de comparaciones existente con un branch nuevo antes del `<div className="game-arena">` mock final:

  ```tsx
  game.id === "asteroides" ? (
    <AsteroidsGame
      key={playId}
      running={!paused && !over}
      onStats={handleStats}
      onGameOver={endGame}
    />
  ) : game.id === "caida" ? (
    <TetrisGame
      key={playId}
      running={!paused && !over}
      onStats={handleStats}
      onGameOver={endGame}
    />
  ) : game.id === "ranaria" ? (
    <RanariaGame
      key={playId}
      running={!paused && !over}
      onStats={handleStats}
      onGameOver={endGame}
    />
  ) : (
    <div className="game-arena">...</div>
  );
  ```

  El resto de `PlayerScreen.tsx` (HUD, modal de fin de partida, `handleStats`, `restart`, `endGame`, el ticker mock condicionado por `isPlayable`) no cambia.

**Out of scope (for future specs):**

- Migración de `supabase/migrations/`: **no aplica**. La fila `ranaria` ya está sembrada en `0002_seed_games.sql` con `cat`/`color`/`cover` ya correctos para este spec; no hay ningún `INSERT` ni `UPDATE` que hacer.
- Clase CSS `.cover-<id>`: **no aplica**. `.cover-rana` ya existe en `app/globals.css:491` y coincide con el `cover` de la fila.
- Regenerar `database.types.ts`: no aplica, ningún cambio de esquema.
- Refactorizar `PlayerScreen.tsx`/`lib/game-registry.ts` hacia el patrón `getPlayableGame` de `.claude/skills/add-game/porting-guide.md` — esa migración de arquitectura, si se decide, es un spec propio e independiente de esta jam; no se mezcla aquí para no ampliar el alcance de conectar un solo juego.
- Cualquier cambio a los otros 5 juegos con mock (`bloque-buster`, `serpentina`, `gloton`, `invasores`, `duelo-pixel`).
- Leaderboard: cero cambios de código, ya es genérico sobre `game_id`.

---

## Data model

Este spec no introduce datos nuevos. Reutiliza la fila `ranaria` ya existente en `games` (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `sort_order` sin cambios) y `ScoreRow`/`saveScore` ya definidos por SPEC 06. El único tipo nuevo es el `Set` extendido en `lib/game-registry.ts`:

```ts
// lib/game-registry.ts — único cambio de este archivo
const PLAYABLE_GAME_IDS = new Set(["asteroides", "caida", "ranaria"]);
```

---

## Implementation plan

1. Confirmar contra Supabase (`select id, cat, cover, color, sort_order from games where id = 'ranaria'`) que la fila sigue siendo `ARCADE`/`cover-rana`/`green`/`6` antes de tocar código, para detectar cualquier deriva desde la Fase 1 de esta jam. Verificación manual: la consulta devuelve exactamente esos valores.
2. Editar `lib/game-registry.ts`: añadir `"ranaria"` al `Set` de `PLAYABLE_GAME_IDS`. Verificación manual: `isPlayable("ranaria")` devuelve `true`; `isPlayable("bloque-buster")` sigue devolviendo `false`.
3. Editar `components/PlayerScreen.tsx`: añadir el import de `RanariaGame` y el branch nuevo en la cadena de comparaciones, en el orden exacto descrito en Scope (después de `caida`, antes del mock). Verificación manual: `/jugar/ranaria` muestra el canvas de `RanariaGame` en vez del `.game-arena` mock; `/jugar/asteroides`, `/jugar/caida` y `/jugar/bloque-buster` (u otro mock) no cambian su comportamiento.
4. Confirmar que `PlayerScreen` reporta `score`/`lives`/`level` reales para `ranaria` (vía `isPlayable` → HUD toma `onStats`, no el ticker mock) y que el modal de fin de partida se dispara al llegar a `lives = 0` en `RanariaGame`. Verificación manual: jugar hasta perder las 3 vidas, ver el modal "TUS INICIALES", y confirmar que las flechas del teclado mueven el cursor del input sin mover la rana de fondo (porque `running` ya es `false` en ese punto).
5. Guardar una puntuación de prueba y confirmar que aparece en `/juegos/ranaria` y en `/salon`, y que antes de esa primera partida ambas páginas muestran `"AÚN NO HAY PUNTUACIONES"`. Verificación manual: recorrido completo de guardado, sin tocar `lib/queries.ts` ni `SessionProvider.tsx`.
6. Pasada final: `npm run lint` y `npm run build` sin errores; recorrido manual completo — jugar una partida de `ranaria` de principio a fin (incluye perder al menos una vida y completar al menos una ronda), pausar/reanudar a medio juego, botón FIN, "JUGAR DE NUEVO", y confirmar cero regresiones en `/jugar/asteroides`, `/jugar/caida` y un mock restante (p. ej. `/jugar/serpentina`).

---

## Acceptance criteria

- [ ] `isPlayable("ranaria")` devuelve `true`; el resto de ids con mock siguen devolviendo `false`.
- [ ] `/jugar/ranaria` renderiza `RanariaGame` en vez del `.game-arena` mock.
- [ ] El HUD de `/jugar/ranaria` muestra `score`/`lives`/`level` reales, actualizados por `onStats`, no por el ticker aleatorio.
- [ ] Perder las 3 vidas en `RanariaGame` dispara el modal "TUS INICIALES" una sola vez.
- [ ] Guardar una puntuación de `ranaria` aparece en `/juegos/ranaria` y en `/salon`; antes de la primera partida guardada, ambas páginas muestran `"AÚN NO HAY PUNTUACIONES"`.
- [ ] Ninguna migración nueva de Supabase se crea ni se aplica para este spec.
- [ ] Ninguna clase CSS nueva se añade a `app/globals.css` para este spec.
- [ ] `/jugar/asteroides`, `/jugar/caida` y al menos un juego con mock restante siguen funcionando exactamente igual que antes de este spec.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

---

## Decisions

- **Sí:** seguir la forma real del código actual (`Set` + cadena de comparaciones) en vez de la forma aspiracional del `getPlayableGame` que describe `.claude/skills/add-game/porting-guide.md`. Introducir esa refactorización de arquitectura como parte de conectar un solo juego mezclaría dos cambios de alcance distinto; si se decide adoptar el patrón `getPlayableGame`, debe ser su propio spec, aplicado a los tres juegos reales a la vez.
- **Sí:** cero migración de Supabase. La fila `ranaria` ya tiene `cat`/`color`/`cover` correctos para esta mecánica — coincide con el patrón ya usado por SPEC 07 para `caida`, cuya fila tampoco necesitó migración.
- **Sí:** cero CSS nuevo. `.cover-rana` ya existe y coincide con el `cover` de la fila; crear `.cover-ranaria` sin uso sería un archivo muerto.
- **No:** no se toca `database.types.ts` — ningún cambio de esquema lo justifica.
- **No:** no se añade pausa por teclado (`P`/`Escape`) dentro de `RanariaGame` — mismo criterio que `AsteroidsGame`/`TetrisGame`: `running` ya resuelve pausa y captura de teclado con un solo mecanismo.

---

## Risks

| Risk                                                                                                                             | Mitigation                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| La cadena de comparaciones en `PlayerScreen.tsx` crece a un tercer branch — un cuarto juego real la haría cada vez menos legible | Aceptado para este spec; si se llega a un cuarto juego real, ese es el punto natural para migrar a `getPlayableGame` en un spec dedicado        |
| Confiar en que `.cover-rana` (no `.cover-ranaria`) siga siendo el valor exacto de `cover` en la fila `ranaria`                   | Mitigado con el paso de verificación explícito contra Supabase antes de tocar código (paso 1 del plan)                                          |
| El branch nuevo se inserta en el orden incorrecto de la cadena ternaria y rompe la sintaxis de JSX                               | Mitigado con la verificación manual del paso 3 en las cuatro rutas (`ranaria`, `asteroides`, `caida`, un mock) antes de dar el paso por cerrado |

---

## What is **not** in this spec

- El componente `RanariaGame` en sí — eso es SPEC 01.
- Cualquier migración de `games` o clase CSS de portada — ninguna hace falta.
- La migración de `PlayerScreen`/`lib/game-registry.ts` hacia el patrón `getPlayableGame`.
- Balance de dificultad, efectos visuales, y cierre de la jam — eso es SPEC 03.
- Tests automatizados (no hay test runner configurado).

Cada uno de estos, si se implementa, va en su propio spec.

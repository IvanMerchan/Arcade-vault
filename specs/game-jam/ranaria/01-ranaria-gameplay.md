# SPEC 01 — Mecánica de juego real para RANARIA (id `ranaria`)

> **Status:** Borrador
> **Depends on:** —
> **Date:** 2026-08-14
> **Objective:** Diseñar el loop jugable completo de RANARIA (cruce de carriles de tráfico y de un río con troncos/tortugas a la deriva) como componente canvas autocontenido que implementa el contrato `PlayableGameProps`, sin tocar todavía el registro de juegos ni el catálogo.

---

## Por qué este spec

El tema de esta game jam ("Frogger: cruza la calle y el río sin perder") coincide exactamente con la ficha `ranaria` que ya vive en la tabla `games` (`ARCADE`, `green`, `cover-rana`, `sort_order 6`, `short`: "Cruza la autopista de pixeles.", `long`: "Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo."). Verificado en vivo contra Supabase antes de escribir este spec: la fila existe, sin cambios pendientes.

`ranaria` fue evaluada dos veces por el agente `game-planner` (`references/game-suggestions.md`, Ronda 1 y Ronda 2, ambas 2026-08-14) y marcada `Descartado` **por redundancia de categoría ARCADE** frente a `serpentina`/`bloque-buster`/`esquiva-meteoros` — nunca por inviabilidad técnica; la cita exacta es "Encaje técnico correcto pero mismo hueco ARCADE ya cubierto por candidatos más baratos". Esta jam parte de un brief específico sobre el tema Frogger, no de la cola general de prioridades de `game-planner`, así que ese descarte por prioridad no aplica aquí: se reutiliza el `id` `ranaria` porque es el concepto de los tres evaluados en la jam que exige cero migración de catálogo (la fila y la portada ya existen) y reusa el patrón grid-por-tick que `caida` (SPEC 07) ya validó en producción.

Este spec cubre solo la mecánica y el componente `RanariaGame`; la integración con `lib/game-registry.ts` y `PlayerScreen.tsx` es SPEC 02, y el pulido visual/balance es SPEC 03.

---

## Scope

**In:**

- `components/RanariaGame.tsx` (`"use client"`), canvas interno fijo `800×600`, con un tablero de grid discreto de `COLS = 20` columnas (`CELL_W = 40`) y `ROWS = 13` filas (`CELL_H = 600 / 13`).
- Distribución de filas, de arriba (`row 0`, meta) hacia abajo (`row 12`, salida):
  - `row 0`: fila de meta, con `N_GOALS = 5` huecos de nenúfar en las columnas `[1, 5, 9, 13, 17]`.
  - `rows 1–5`: 5 carriles de río (troncos/tortugas a la deriva).
  - `row 6`: mediana segura.
  - `rows 7–11`: 5 carriles de tráfico (coches).
  - `row 12`: fila de salida, segura.
- Movimiento de la rana en saltos discretos de una celda por pulsación de flecha, usando el mismo patrón `keys`/`justPressed` con detección de flanco que `AsteroidsGame`/`TetrisGame` (una pulsación física = un salto, sin repetición automática al mantener la tecla presionada).
- Carriles de tráfico: coches como rectángulos (`width = 60`) que se mueven a velocidad y dirección fijas por carril, con wraparound (al salir de un borde reaparecen por el otro).
- Carriles de río: plataformas (troncos/tortugas, visualmente distintas pero funcionalmente idénticas en esta versión — ver Decisions) como rectángulos (`width = 100`) con el mismo movimiento y wraparound que los coches. Mientras la rana está sobre una fila de río y su columna se solapa con una plataforma, la rana se desplaza horizontalmente con la plataforma (`frog.x += laneSpeed * direction * dt`).
- Condición de caída al agua: la rana está en una fila de río sin ninguna plataforma bajo su posición actual, o es arrastrada por una plataforma fuera de los límites `[0, 800]` del canvas.
- Condición de meta: la rana llega a `row 0` exactamente en la columna de un hueco de nenúfar. Si el hueco está vacío, se ocupa; si ya está ocupado, o la columna no coincide con ningún hueco, cuenta como fallo (misma penalización que caer al agua).
- Cronómetro de ronda: `roundTime(level) = max(15, 30 - (level - 1) * 2)` segundos, cuenta regresiva mientras la ronda está activa; llegar a 0 cuenta como fallo (misma penalización que un atropello).
- Ronda completa: al ocupar los 5 huecos de nenúfar, `level += 1`, se reinicia el cronómetro con `roundTime(level)`, se recalculan las velocidades de carril, se vacían los huecos, y la rana vuelve a la fila de salida.
- Escalado de dificultad por nivel: `laneSpeed(level) = baseSpeed * min(1 + (level - 1) * 0.12, 2.5)`, aplicado a cada carril de tráfico y de río.
- `Data model` con el estado completo dentro de un único `useRef`, sin `useState`.
- Contrato `PlayableGameProps` (`running`, `onStats`, `onGameOver`) implementado con el mismo patrón que `AsteroidsGame`: callbacks reflejados en refs vía `useEffect`, loop principal dentro de `useEffect(() => {...}, [running])` con `requestAnimationFrame`, `dt` clamado a `0.05`, `lastTime = null` al reanudar, cleanup con `cancelAnimationFrame` + remoción de listeners de teclado.

**Out of scope (for future specs):**

- Cualquier cambio a `lib/game-registry.ts`, `components/PlayerScreen.tsx`, migraciones de Supabase o CSS de portada — eso es SPEC 02.
- Animación de salto con interpolación visual (squash/stretch), efectos de partículas, glow neón coherente con `.crt-screen`, sonido — eso es SPEC 03 (salvo el dibujo funcional mínimo necesario para distinguir carriles/entidades, que sí es parte de este spec).
- Tortugas que se sumergen periódicamente (ver Decisions) — no se implementa en esta versión.
- Cualquier modo multijugador o versus — RANARIA es estrictamente de un jugador.
- Persistencia de progreso entre partidas (más allá del leaderboard, que ya es genérico y no requiere cambios).

---

## Data model

```ts
// components/RanariaGame.tsx — todo el estado mutable vive en un único useRef

type LaneKind = "road" | "water";

type Lane = {
  row: number; // 1–5 (agua) o 7–11 (tráfico)
  kind: LaneKind;
  direction: 1 | -1;
  baseSpeed: number; // px/s a nivel 1
  obstacles: { x: number; width: number }[]; // coches (road) o troncos/tortugas (water)
};

type Frog = {
  col: number; // columna de grid, 0..COLS-1 (fraccional mientras es arrastrada por una plataforma)
  row: number; // fila de grid, 0..ROWS-1 (0 = meta, 12 = salida)
};

type RanariaState = {
  lanes: Lane[]; // 10 carriles: 5 water (rows 1–5) + 5 road (rows 7–11)
  frog: Frog;
  goalSlots: boolean[]; // longitud N_GOALS = 5, true = ocupado
  maxProgressRow: number; // fila más cercana a la meta alcanzada en esta vida (para el scoring anti-farming)
  score: number;
  lives: number;
  level: number;
  roundTimer: number; // segundos restantes de la ronda actual
  gameOver: boolean;
  gameOverNotified: boolean;
  keys: Record<string, boolean>;
  justPressed: Record<string, boolean>;
  lastTime: number | null;
};
```

Constantes de módulo: `W = 800`, `H = 600`, `COLS = 20`, `CELL_W = 40`, `ROWS = 13`, `CELL_H = H / ROWS`, `N_GOALS = 5`, `GOAL_COLS = [1, 5, 9, 13, 17]`, velocidades base por carril (`baseSpeed` en px/s, nivel 1): agua `[40, 55, 45, 60, 50]` con direcciones alternadas `[-1, 1, -1, 1, -1]`; tráfico `[70, 90, 65, 100, 80]` con direcciones alternadas `[1, -1, 1, -1, 1]`.

---

## Implementation plan

1. Crear `components/RanariaGame.tsx` con las constantes de módulo, `createInitialState()` (10 carriles con sus obstáculos iniciales espaciados, rana en `row 12`, `col = 10`, `goalSlots` vacíos, `roundTimer = roundTime(1)`), y un render estático del tablero (filas de meta/agua/mediana/tráfico/salida diferenciadas por color de fondo) dentro de un `<canvas width={800} height={600}>`. Verificación manual: montar temporalmente `<RanariaGame running={false} onStats={console.log} onGameOver={console.log} />` en cualquier ruta de prueba y ver las 13 filas dibujadas en el orden correcto.
2. Añadir el movimiento de la rana por flechas con detección de flanco (`keys`/`justPressed`), limitado a los límites del tablero (`col` en `[0, COLS-1]`, `row` en `[0, ROWS-1]`). Verificación manual: cada pulsación de flecha mueve la rana exactamente una celda, sin repetición al mantener presionada.
3. Añadir el movimiento continuo de obstáculos por carril (`obstacles[i].x += direction * laneSpeed * dt`, con wraparound), y la lógica de colisión en carriles de tráfico (game over parcial → pérdida de vida) y de arrastre/caída en carriles de agua (rana se mueve con la plataforma bajo ella, o pierde una vida si no hay ninguna). Verificación manual: cruzar un carril de tráfico sin moverse resulta en atropello; pisar un carril de agua sin tronco bajo la rana resulta en caída; pisar un tronco arrastra a la rana con él.
4. Añadir la lógica de meta: detección de columna de nenúfar en `row 0`, ocupación de huecos vacíos, penalización por hueco ocupado o columna sin nenúfar, y la condición de ronda completa (los 5 huecos llenos) con el reinicio de nivel descrito en Scope. Verificación manual: llenar los 5 huecos sube el nivel, reinicia el cronómetro y acelera los carriles; pisar un hueco ya ocupado cuenta como fallo.
5. Añadir el cronómetro de ronda (`roundTimer -= dt`, fallo al llegar a 0) y el sistema de puntuación: `+10` cuando `frog.row < maxProgressRow` (actualizando `maxProgressRow` tras sumar), `+50` al ocupar un hueco vacío, `+ Math.floor(roundTimer) * 5` de bono de tiempo en ese mismo instante, `+200` extra al completar la ronda. Verificación manual: hacer y deshacer el mismo tramo de avance no repite puntos; completar una ronda rápido da más bono de tiempo que completarla al límite del cronómetro.
6. Añadir vidas: `lives = 3` inicial, `-1` en cada fallo (atropello, caída al agua, columna de meta inválida, cronómetro a 0), reposición de la rana en `row 12`/`col 10` y reinicio de `roundTimer`/`maxProgressRow` sin tocar `goalSlots` ya ocupados; `lives <= 0` dispara `gameOver = true`. Verificación manual: perder las 3 vidas termina la partida; perder una vida a mitad de ronda conserva los huecos de nenúfar ya ocupados.
7. Completar el contrato `PlayableGameProps`: `running` arranca/detiene el loop y los listeners de teclado; `onStats` se dispara solo cuando `score`/`lives`/`level` cambian (comparados contra el último valor reportado, mismo patrón `lastStatsRef` de `AsteroidsGame`); `onGameOver` se dispara una única vez con guard `gameOverNotified` cuando `lives` llega a 0. Verificación manual: togglear `running` desde un botón temporal congela y descongela coches/troncos/cronómetro sin saltos.
8. Pasada final: `npm run lint` y `npm run build` sin errores; recorrido manual completo del componente en aislamiento — cruzar tráfico, cruzar río sobre troncos, caer al agua, ser atropellado, ocupar los 5 huecos y subir de nivel, agotar el cronómetro, perder las 3 vidas y confirmar que `onGameOver` se dispara una sola vez.

---

## Acceptance criteria

- [ ] El tablero dibuja 13 filas distinguibles: 1 meta (con 5 huecos de nenúfar), 5 de río, 1 mediana, 5 de tráfico, 1 de salida.
- [ ] Las flechas mueven la rana una celda por pulsación física, sin repetición automática al mantener presionada.
- [ ] Un carril de tráfico atropella a la rana si su celda coincide con un coche; se pierde una vida y la rana vuelve a la fila de salida.
- [ ] Un carril de río sin tronco/tortuga bajo la rana la hace caer al agua; se pierde una vida.
- [ ] Estar sobre un tronco/tortuga arrastra a la rana con la velocidad y dirección de esa plataforma; ser arrastrada fuera de los límites del canvas cuenta como caída.
- [ ] Llegar a `row 0` en la columna de un hueco vacío lo ocupa y suma `+50` más el bono de tiempo; llegar a un hueco ya ocupado o a una columna sin nenúfar cuenta como fallo.
- [ ] Ocupar los 5 huecos en la misma ronda sube el nivel, reinicia el cronómetro y los huecos, y acelera los carriles según `laneSpeed(level)`.
- [ ] El cronómetro de ronda llega a 0 y cuenta como fallo si la rana no alcanzó un hueco vacío a tiempo.
- [ ] La puntuación por avance (`+10`) solo se otorga la primera vez que la rana alcanza una fila más cercana a la meta que su mejor marca en esa vida — repetir el mismo tramo no repite puntos.
- [ ] `lives` empieza en 3, baja en cada fallo, y `lives = 0` dispara game over una sola vez.
- [ ] El canvas no dibuja su propio HUD (puntuación/vidas/nivel) ni una pantalla de game over propia.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

---

## Decisions

- **Sí:** reutilizar el `id` `ranaria` y su fila ya sembrada en `games` en lugar de acuñar un `id` nuevo. La ficha ya describe exactamente esta mecánica (`short`/`long` ya hablan de carriles de coches y troncos a la deriva) y reutilizarla evita cualquier migración de catálogo — el coste de integración más bajo de los tres conceptos evaluados en esta jam.
- **Sí:** el scoring de avance (`+10`) se basa en `maxProgressRow` por vida, no en cada salto hacia adelante sin más. Sin esto, oscilar arriba/abajo repetidamente generaría puntos infinitos — el mismo problema que el Frogger original resuelve limitando el puntaje al progreso neto.
- **Sí:** perder una vida conserva los huecos de nenúfar ya ocupados en la ronda (solo se reinicia la posición de la rana, el cronómetro y `maxProgressRow`). Es más justo que reiniciar la ronda entera y mantiene el ritmo de partida corto.
- **No:** las tortugas no se sumergen periódicamente pese a ser parte del Frogger clásico. Añadir un estado de inmersión con temporizador propio duplica la complejidad de colisión de los carriles de agua sin cambiar la mecánica central de cruce; se documenta como candidato explícito para un spec de pulido futuro si se decide profundizar.
- **No:** troncos y tortugas son funcionalmente idénticos en esta versión (solo cambia el sprite en SPEC 03) — mantiene una única rama de lógica de colisión para todo el carril de agua en vez de dos.
- **No:** no hay cooldown de movimiento adicional más allá de la detección de flanco por tecla — el patrón `justPressed` ya usado por `AsteroidsGame`/`TetrisGame` es suficiente para limitar un salto por pulsación física, sin introducir un temporizador nuevo.

---

## Risks

| Risk                                                                                                                                                                                             | Mitigation                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CELL_H = 600 / 13 ≈ 46.15` no es un entero, a diferencia de `CELL_W = 40`                                                                                                                       | Aceptado: el canvas soporta coordenadas fraccionarias sin problema visual; alternativa (ajustar `ROWS` para dividir 600 exacto) cambiaría el diseño de 13 filas del Frogger clásico, que es preferible |
| El scoring por `maxProgressRow` puede sentirse injusto si el jugador retrocede por error para esquivar un coche y luego re-avanza sin puntos                                                     | Aceptado por diseño — es el comportamiento del Frogger original; se puede documentar en el HUD/tutorial en un spec de pulido si genera confusión                                                       |
| Fallar por cronómetro a 0 resta una vida igual que un atropello, lo que puede sentirse severo en niveles altos con `roundTime` más corto                                                         | Mitigado por el propio `roundTime(level) = max(15, ...)`, que nunca baja de 15s; ajustable en SPEC 03 si el playtesting lo pide                                                                        |
| Detectar "columna de meta inválida" exige coincidencia exacta de columna (`frog.col === slotCol`), sin tolerancia — puede sentirse muy estricto comparado con un Frogger con hitbox más generosa | Aceptado en el MVP por simplicidad de colisión; se puede ampliar la tolerancia a ±1 columna en SPEC 03 sin cambiar el modelo de datos                                                                  |

---

## What is **not** in this spec

- La entrada en `PLAYABLE_GAME_IDS` de `lib/game-registry.ts` y el branch nuevo en `PlayerScreen.tsx`.
- Cualquier migración de `games` o clase CSS de portada (ninguna de las dos hace falta — ver SPEC 02).
- Animaciones de salto, partículas, glow neón, sonido, y cualquier ajuste de balance más allá de las fórmulas fijadas aquí.
- Tortugas que se sumergen.
- Tolerancia de columna en el hueco de meta.
- Tests automatizados (no hay test runner configurado).

Cada uno de estos, si se implementa, va en su propio spec.

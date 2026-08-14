# SPEC 07 — Juego real de Tetris en CAÍDA (id `caida`) + registro genérico de juegos

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 05, SPEC 06
> **Date:** 2026-08-14
> **Objective:** Reemplazar el arena mock de `PlayerScreen` por el Tetris real (portado de `references/started-games/03-tetris/game.js`) para el juego con id `caida`, introduciendo `lib/game-registry.ts` como el mecanismo genérico que conecta un `game.id` con su componente jugable, en reemplazo del `isAsteroids` hardcodeado.

---

## Por qué este spec

`references/started-games/03-tetris/` ya no está vacía: contiene un Tetris completo en canvas puro (`game.js`, 619 líneas), sin dependencias, con exactamente el mismo patrón de fuente que `02-asteroids` usó en SPEC 04. El catálogo ya tiene sembrada la ficha `caida` (`CAÍDA`, `PUZZLE`, `cover-tetro`, magenta, `sort_order 1`) con una descripción larga que ya describe este juego ("Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas").

Al ser el segundo juego real de la plataforma, este spec también resuelve lo que SPEC 04 dejó explícitamente abierto: "una arquitectura genérica de juego real conectable". Hoy `components/PlayerScreen.tsx` decide con `const isAsteroids = game.id === "asteroides"`; con un segundo juego real ese patrón deja de escalar, así que este spec introduce `lib/game-registry.ts` (un mapa `id → componente`) y refactoriza `PlayerScreen` para usarlo.

`references/started-games/03-tetris/game.js` trae bastante más que el Tetris básico: un `requirements.md` local pidió tres features extra (menú de pausa completo, tabla de records en `localStorage`, y 4 skins visuales) que sí están implementadas en el código. Este spec decide, feature por feature, cuáles se portan y cuáles las reemplaza lo que ya existe en Arcade Vault.

También hay una discrepancia entre el código y su propia documentación: el `README.md` y el `CLAUDE.md` locales describen "7 piezas estándar" y "~300 líneas", pero el código real (`PIECES`, 137 líneas) define **8** piezas — las 7 estándar (I, O, T, S, Z, J, L) más una pieza `N` ("tuerca", gris, matriz 3×3 hueca) que ninguna documentación menciona. La norma de este skill es que gana el código sobre el README; para este juego en particular, tras consultarlo, se decidió por excepción **no** portar la pieza N (ver Decisions).

---

## Scope

**In:**

- Crear `lib/game-registry.ts` (`"use client"`) con:
  - `type GameStats = { score: number; lives: number; level: number }`
  - `type PlayableGameProps = { running: boolean; onStats: (stats: GameStats) => void; onGameOver: (finalScore: number) => void }`
  - un mapa `PLAYABLE_GAMES: Record<string, ComponentType<PlayableGameProps>>` con imports estáticos (no `next/dynamic`), inicialmente `{ asteroides: AsteroidsGame, caida: TetrisGame }`
  - `function getPlayableGame(id: string): ComponentType<PlayableGameProps> | null`
- Refactorizar `components/PlayerScreen.tsx`: reemplazar `const isAsteroids = game.id === "asteroides"` por `const Playable = getPlayableGame(game.id)`; renombrar el estado `asteroidsLevel` a `gameLevel`; actualizar la guarda y las dependencias del `useEffect` del ticker de puntaje falso (hoy `if (isAsteroids || over || paused) return;` / `[isAsteroids, over, paused]`) para usar `Playable`; actualizar el ternario de render para usar `<Playable .../>` en vez de `<AsteroidsGame .../>` codificado. El comportamiento para `asteroides` y para el resto de mocks no cambia.
- Crear `components/TetrisGame.tsx` (`"use client"`) portando de `game.js`: el modelo de tablero (`ROWS×COLS`, 0 = vacía, 1–7 = color), las 7 piezas estándar (`PIECES` sin la entrada `N`), rotación con wall kicks (`rotateCW`, `tryRotate`), colisión (`collide`), el ciclo de pieza (`spawn`, `merge`, `clearLines`, `lockPiece`), soft drop y hard drop, el ghost piece, y el cálculo de nivel/velocidad (`dropInterval = max(100, 1000 − (level−1)×90)`, nivel sube cada 10 líneas).
- Portar únicamente la función de dibujo de la skin **Neon** del original (`shadowBlur` + `strokeRect` con glow), fija en código — sin selector de skins ni `localStorage`.
- Canvas interno fijo 800×600 (igual proporción que `.crt-screen`, `aspect-ratio: 4/3`), con el tablero de 300×600 centrado horizontalmente, y el espacio sobrante usado para: a la izquierda, `LÍNEAS` y `COMBO` (datos que el HUD de la plataforma no muestra); a la derecha, la vista previa de la pieza `SIGUIENTE` (el `next-canvas` del original, integrado en el mismo canvas).
- `TetrisGame` implementa el contrato `PlayableGameProps`: `running` arranca/detiene el loop (`requestAnimationFrame`) y los listeners de teclado; `onStats` se dispara solo cuando `score`/`lives`/`level` cambian; `onGameOver` se dispara una única vez (guard `gameOverNotified`) cuando una pieza nueva colisiona al aparecer (equivalente al `endGame()` del original).
- `lives` se envía como `1` durante toda la partida y `0` en el momento del game over — Tetris no tiene vidas, y esto hace que el corazón del HUD se apague al perder, igual que en cualquier otro juego.
- Registrar `caida: TetrisGame` en `PLAYABLE_GAMES`.
- Todo el estado mutable de la partida (tablero, pieza actual/siguiente, score, líneas, nivel, combo) vive en un único `useRef`, nunca en `useState` — mismo patrón que `AsteroidsGame`.

**Out of scope (for future specs):**

- El leaderboard no requiere ningún cambio de código: `lib/queries.ts` (`getTopScores`, `getAllTopScores`), `app/juegos/[id]/page.tsx`, `components/HallOfFame.tsx` y `SessionProvider.saveScore` ya son genéricos sobre `game_id`. Guardar una puntuación de CAÍDA usa exactamente el mismo camino que ROCAS.
- La fila `caida` en la tabla `games` ya existe (`0002_seed_games.sql`) y su descripción ya coincide con este juego — no hace falta ninguna migración nueva ni tocar `title`/`short`/`long`/`cat`/`sort_order`.
- La clase CSS `.cover-tetro` ya existe (`app/globals.css:407`) — no hace falta CSS de portada nuevo.
- La pieza `N` ("tuerca") del código original — decisión explícita, ver Decisions.
- Los otros 6 juegos con mock (`bloque-buster`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) siguen exactamente igual.
- Tabla de records en `localStorage` (`tetris_records`), input de nombre al game over del original, botón de reset de records — el leaderboard real de SPEC 06 reemplaza esto por completo.
- Overlays DOM propios de PAUSA y GAME OVER, HUD DOM (`#score`/`#lines`/`#level`) — los sustituyen el HUD y el modal ya existentes de `PlayerScreen`.
- Selector de skins (Retro/Pastel/Pixel), toggle de tema claro/oscuro, selector de nivel inicial (1–15), panel de controles desplegable — features del original no relacionadas con el core del juego.
- Pausa con las teclas `P`/`Escape` — la pausa es exclusivamente el botón de la plataforma, vía la prop `running`.
- Controles táctiles/móviles, audio.
- Tests automatizados (no hay test runner configurado).

---

## Data model

Este spec no introduce estructuras de datos persistidas nuevas; reutiliza `ScoreRow`/`saveScore` de SPEC 06 y la fila existente de `games` con id `caida`. El estado interno del juego vive solo dentro de `TetrisGame` mientras está montado.

```ts
// lib/game-registry.ts
export type GameStats = { score: number; lives: number; level: number };

export type PlayableGameProps = {
  running: boolean;
  onStats: (stats: GameStats) => void;
  onGameOver: (finalScore: number) => void;
};

export function getPlayableGame(id: string): ComponentType<PlayableGameProps> | null;
```

```ts
// components/TetrisGame.tsx — estado interno, dentro de un único useRef
type Piece = { type: number; shape: number[][]; x: number; y: number };

type TetrisState = {
  board: number[][]; // ROWS×COLS, 0 = vacía, 1–7 = índice de color
  current: Piece;
  next: Piece;
  score: number;
  lines: number;
  level: number;
  dropAccum: number;
  dropInterval: number;
  currentCombo: number;
  maxCombo: number;
  lastClearWasCombo: boolean;
  gameOver: boolean;
  gameOverNotified: boolean;
  lastTime: number | null;
  keys: Record<string, boolean>;
};
```

Constantes portadas sin cambios desde `game.js`: `COLS = 10`, `ROWS = 20`, `BLOCK = 30`, `LINE_SCORES = [0, 100, 300, 500, 800]`.

---

## Implementation plan

1. Crear `lib/game-registry.ts` con `GameStats`, `PlayableGameProps`, `getPlayableGame`, y el mapa `PLAYABLE_GAMES` con una única entrada `{ asteroides: AsteroidsGame }` (todavía sin `caida`, que se añade en el paso 8). Verificación manual: `npm run dev`, `/jugar/asteroides` sigue funcionando sin cambios visibles.
2. Editar `components/PlayerScreen.tsx`: sustituir `isAsteroids` por `Playable = getPlayableGame(game.id)`, renombrar `asteroidsLevel`/`setAsteroidsLevel` a `gameLevel`/`setGameLevel`, actualizar la guarda y dependencias del `useEffect` del ticker mock, y el ternario de render para usar `<Playable key={playId} running={...} onStats={...} onGameOver={...} />`. Verificación manual: `/jugar/asteroides` y `/jugar/bloque-buster` (o cualquier otro mock) se comportan exactamente igual que antes del cambio.
3. Crear `components/TetrisGame.tsx` (`"use client"`) con las constantes, las 7 piezas estándar (`PIECES` sin `N`), la función de dibujo Neon, `createBoard`, `collide`, `rotateCW`/`tryRotate`, y un render estático del tablero 10×20 centrado dentro de un canvas 800×600, con la rejilla. Verificación manual: montar temporalmente `<TetrisGame running={false} onStats={console.log} onGameOver={console.log} />` en `/jugar/caida` (sin registrar aún) y ver el tablero vacío dibujado correctamente.
4. Añadir a `TetrisGame` la gravedad y el ciclo de pieza: loop con `requestAnimationFrame`, `dropAccum`/`dropInterval`, `spawn`/`merge`/`clearLines`/`lockPiece`, cálculo de nivel y puntuación (`LINE_SCORES[cleared] * level`, hard drop `+2` por celda, soft drop `+1` por fila), y el ghost piece a `globalAlpha 0.2`. Verificación manual: las piezas caen solas y se apilan; limpiar una línea la elimina y sube el contador.
5. Añadir los controles de teclado: `←`/`→` mover, `↑`/`X` rotar con wall kicks `[0, −1, 1, −2, 2]`, `↓` soft drop, `Espacio` hard drop con `preventDefault()`. Sin `P`/`Escape`. Verificación manual: cada tecla produce el movimiento esperado, incluida la rotación pegada a la pared.
6. Añadir los paneles laterales dibujados en el mismo canvas: `LÍNEAS` y `COMBO` a la izquierda del tablero, la vista previa de `SIGUIENTE` a la derecha (reutilizando el cálculo de offset de centrado de `drawNext` del original). Verificación manual: al limpiar líneas consecutivas sin que caiga una pieza entremedias, el combo sube; la vista previa coincide con la próxima pieza que aparece.
7. Completar el contrato `PlayableGameProps` en `TetrisGame`: prop `running` que arranca/detiene el loop y los listeners de teclado (mismo patrón que `AsteroidsGame`: callbacks reflejados en refs, `lastTime = null` al reanudar); `onStats` disparado solo cuando `score`/`lives`/`level` cambian, con `lives` fijo en `1` hasta el game over; `onGameOver` disparado una sola vez con guard `gameOverNotified` cuando `spawn()` colisiona de inmediato. Verificación manual: togglear `running` desde un botón temporal congela y descongela el juego sin saltos.
8. En `lib/game-registry.ts`, añadir `caida: TetrisGame` al mapa `PLAYABLE_GAMES`. Quitar el montaje temporal usado en el paso 3 si seguía presente. Verificación manual: `/jugar/caida` ahora muestra el Tetris real en vez del `.game-arena` mock.
9. Pasada final: `npm run lint` y `npm run build` sin errores; recorrido manual en `/jugar/caida` (mover, rotar pegado a la pared, soft drop, hard drop, limpiar 1/2/3/4 líneas y confirmar los puntos exactos, subir de nivel cada 10 líneas, perder al topar la pieza nueva, guardar la puntuación con iniciales usando las flechas del teclado sin mover piezas, "JUGAR DE NUEVO", pausar/reanudar a medio juego, botón FIN) y en `/jugar/asteroides` + un mock (confirmar cero regresiones).

---

## Acceptance criteria

- [x] El tablero 10×20 se dibuja centrado en el canvas 800×600, con la rejilla y el estilo Neon (glow), y paneles de `LÍNEAS`/`COMBO`/`SIGUIENTE` alrededor.
- [x] Solo aparecen las 7 piezas estándar (I, O, T, S, Z, J, L); la pieza `N` ("tuerca") nunca se genera.
- [x] `←`/`→` mueven la pieza; `↑` y `X` la rotan con wall kicks funcionando pegada a la pared; `↓` hace soft drop; `Espacio` hace hard drop instantáneo.
- [x] El ghost piece se ve semitransparente (`alpha` ≈ 0.2) en la posición donde aterrizaría la pieza actual.
- [x] Limpiar 1, 2, 3 o 4 líneas de una vez suma exactamente 100, 300, 500 u 800 puntos multiplicados por el nivel actual.
- [x] Hard drop suma 2 puntos por celda recorrida; soft drop suma 1 punto por fila bajada.
- [x] El nivel sube cada 10 líneas acumuladas y la velocidad de caída aumenta en consecuencia.
- [x] El canvas no dibuja Puntuación ni Nivel propios ni una pantalla de game over propia — esa información solo vive en el HUD y el modal de `PlayerScreen`.
- [x] El HUD `Vidas` muestra 1 corazón durante la partida y 0 al perder (cuando una pieza nueva no cabe al aparecer).
- [x] PAUSA congela tablero/pieza/tiempos en su posición; REANUDAR continúa sin saltos.
- [x] Con el modal de fin de partida abierto, las flechas del teclado mueven el cursor del input "TUS INICIALES" sin mover ninguna pieza de fondo.
- [x] Guardar la puntuación funciona igual que en ROCAS y aparece en `/juegos/caida` y en `/salon`.
- [x] Antes de la primera partida guardada, `/juegos/caida` y `/salon` muestran el estado vacío `"AÚN NO HAY PUNTUACIONES"`.
- [x] `/jugar/asteroides` y al menos un juego con mock (p. ej. `/jugar/bloque-buster`) siguen funcionando exactamente igual que antes de este spec.
- [x] `npm run lint` y `npm run build` terminan sin errores.

---

## Decisions

- **Sí:** crear `lib/game-registry.ts` con un mapa `id → componente` e imports estáticos (no `next/dynamic`). Cada juego son ~500 líneas sin assets externos que justifiquen un split de bundle, y evita depender de una API de carga diferida de Next 16 sin verificar antes contra `node_modules/next/dist/docs/` (CLAUDE.md lo exige).
- **Sí:** refactorizar `PlayerScreen` para usar el registro en vez de `isAsteroids`. Es la arquitectura genérica que SPEC 04 dejó pendiente para "cuando haya un segundo juego real con el que comparar el patrón" — ya lo hay.
- **Sí:** tablero centrado con paneles laterales (`LÍNEAS`/`COMBO`/`SIGUIENTE`) en vez de barras negras. Aprovecha el marco 4:3 completo sin perder ninguna de las dos features visuales del original, y ninguno de esos datos duplica los tres que ya muestra el HUD de la plataforma.
- **Sí:** `lives: 1 → 0`. Tetris no tiene vidas; esto reutiliza el HUD compartido sin modificarlo, a costa de un corazón que solo tiene dos estados.
- **Sí:** portar solo la skin Neon, fija en código, sin selector. Es la que encaja con la estética CRT/neón del resto de la plataforma; un selector de skins dentro del canvas competiría con los botones de la plataforma sin necesidad real en este MVP.
- **No:** portar la pieza `N` ("tuerca"). El código real la incluye pero ninguna documentación del original la menciona; el criterio por defecto del skill es que gana el código, pero para este juego se decidió explícitamente lo contrario porque es una pieza hueca que rompe la solvabilidad esperada de un Tetris estándar. Queda documentado aquí como la excepción, no como un olvido.
- **No:** tabla de records en `localStorage`, overlays e input de nombre propios del original — el leaderboard real de SPEC 06 ya resuelve exactamente esto, mejor (persistencia real, no solo del navegador).
- **No:** selector de skins/tema/nivel inicial, panel de controles desplegable — features del `requirements.md` original sin equivalente pedido en Arcade Vault; se pueden reconsiderar en un spec futuro si hace falta.
- **No:** pausa con `P`/`Escape`. Dos rutas de pausa (teclado del juego + botón de la plataforma) se desincronizarían sin necesidad; `running` ya resuelve pausa y captura de teclado con un solo mecanismo, igual que en SPEC 04.

---

## Risks

| Risk                                                                                                                                   | Mitigation                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El refactor de `PlayerScreen` (`isAsteroids` → `Playable`) toca el componente que renderizan los 8 juegos, no solo `caida`             | Acceptance criteria explícito de no-regresión en `/jugar/asteroides` y en al menos un juego con mock; el cambio es mecánico (mismo valor booleano/objeto, distinto origen) |
| El tablero ocupa ~37% del ancho del canvas 800×600; en pantallas pequeñas los bloques de 30px pueden verse finos al escalar            | Aceptado: la alternativa (ensanchar `COLS` más allá de 10) cambia la dificultad real del Tetris, que es peor                                                               |
| Sin selector de nivel inicial, toda partida arranca siempre en nivel 1 y más lenta que en el original (que permitía saltar a nivel 15) | Aceptado por decisión explícita; se puede añadir en un spec futuro si se pide                                                                                              |
| `COMBO` era un dato que en el original solo se guardaba junto al record final; aquí queda visible en pantalla todo el tiempo           | Riesgo cosmético menor; trivial de ocultar después si se decide que sobra                                                                                                  |
| Descartar la pieza `N` es una desviación de la regla por defecto "gana el código" del skill `/add-game`                                | Mitigado documentando la excepción explícitamente en `Decisions`, con el motivo, en vez de dejarla implícita                                                               |

---

## What is **not** in this spec

- Los otros 6 juegos con mock del catálogo.
- Migración de `games` para `caida` (la fila ya existe) o CSS de portada nuevo (`cover-tetro` ya existe).
- La pieza `N` ("tuerca") del original.
- Tabla de records en `localStorage`, selector de skins/tema/nivel inicial, panel de controles del original.
- Audio y controles táctiles/móviles.
- Cualquier cambio al flujo de guardado de puntuación o a las páginas de leaderboard (`/juegos/[id]`, `/salon`) — ya son genéricas y no requieren tocarse.
- Tests automatizados (no hay test runner configurado en `package.json`).

Cada uno de estos, si se implementa, va en su propio spec.

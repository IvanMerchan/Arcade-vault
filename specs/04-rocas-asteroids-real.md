# SPEC 04 — Juego real de Asteroids en ROCAS (id `asteroides`)

> **Status:** Implementado
> **Depends on:** SPEC 01
> **Date:** 2026-08-14
> **Objective:** Reemplazar el arena falso de `PlayerScreen` por el juego real de Asteroids (portado de `references/started-games/02-asteroids/game.js`) para el juego con título "ROCAS" — renombrando su `id` de `"rocas"` a `"asteroides"` — dejando el resto del catálogo con el mock actual.

---

## Por qué este spec

`lib/games.ts` ya describe el juego con título "ROCAS" como un juego de asteroides ("Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas...") pero `PlayerScreen` es hoy un mock genérico: dibuja una nave y enemigos estáticos con CSS y suma puntaje aleatorio cada 220ms via `setInterval`, igual para los 8 juegos del catálogo. `references/started-games/02-asteroids` tiene una implementación completa en canvas puro (sin dependencias) que coincide con esa descripción. Este spec la porta para ese juego específicamente; conectar el resto de juegos reales queda para specs futuros, uno por uno.

De paso, su `id` interno pasa de `"rocas"` a `"asteroides"` para que el identificador de código coincida con el juego real que representa. El título visible "ROCAS", la portada `cover-rocas` y el resto de campos de `lib/games.ts` (`cat`, `best`, `plays`) no cambian.

---

## Scope

**In:**

- Renombrar en `lib/games.ts`, dentro de `GAMES`, el `id: "rocas"` a `id: "asteroides"` del objeto con `title: "ROCAS"`. Ningún otro campo de ese objeto (`title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`) cambia.
- Como consecuencia del rename, las rutas dinámicas ya existentes (`app/juegos/[id]/page.tsx`, `app/jugar/[id]/page.tsx`, ambas derivadas de `GAMES` vía `generateStaticParams`) sirven ese juego en `/juegos/asteroides` y `/jugar/asteroides` en vez de `/juegos/rocas` y `/jugar/rocas`, sin tocar el código de esas rutas.
- Portar la lógica de `references/started-games/02-asteroids/game.js` (clases `Bullet`, `Asteroid`, `Ship`, `Particle`, colisiones, niveles, invencibilidad al reaparecer) a un componente cliente nuevo `components/AsteroidsGame.tsx`, sin dependencias nuevas, dentro de un `<canvas>` con resolución interna fija 800×600 (igual que el original).
- El canvas se posiciona `absolute; inset: 0` dentro de `.crt-screen` (que ya usa `aspect-ratio: 4/3`, la misma proporción que 800×600) y se escala al 100% del contenedor por CSS, sin deformarse.
- `PlayerScreen.tsx` renderiza `<AsteroidsGame />` en vez del `.game-arena` mock cuando `game.id === "asteroides"`; para el resto de juegos el `.game-arena` mock y su `setInterval` de puntaje aleatorio siguen exactamente igual.
- `AsteroidsGame` no dibuja su propio HUD (se elimina `drawHUD`) ni su propio overlay de "GAME OVER" con reinicio por Espacio (se elimina `drawOverlay`/el bloque `state === 'gameover'` del original); el HUD (`Puntuación`/`Vidas`/`Nivel`) y el modal de fin de partida que ya existen en `PlayerScreen` son la única UI visible para esa información.
- `AsteroidsGame` notifica a `PlayerScreen` los cambios de score/vidas/nivel vía un callback `onStats`, y el fin de partida (vidas en 0) vía `onGameOver`, solo cuando el valor realmente cambia (no en cada frame de los ~60/s del loop).
- Una prop `running` (`!paused && !over` calculada en `PlayerScreen`) controla si el loop (`requestAnimationFrame`) y los listeners de teclado (`keydown`/`keyup` en `window`) de `AsteroidsGame` están activos. Al ponerse en `false` (por PAUSA o por fin de partida) se detiene el loop y se remueven los listeners; al volver a `true` (REANUDAR) se retoma donde quedó.
- Reinicio: `PlayerScreen` monta `AsteroidsGame` con `key={playId}` (un contador que se incrementa en cada "JUGAR DE NUEVO"); cambiar la `key` fuerza un remount completo de React, reiniciando todo el estado interno del juego desde cero.

**Out of scope (for future specs):**

- Cualquier otro juego del catálogo (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) sigue con el `.game-arena` mock, sin cambios.
- Una arquitectura genérica de "juego real conectable" para el resto del catálogo — se define cuando haya un segundo juego real con el que comparar el patrón.
- Controles táctiles/móviles — el original y este spec son solo teclado (`←` `→` `↑` `Espacio`).
- Power-ups, tipos de asteroide especiales ("estrella fugaz") u otras características que el `README.md` de referencia menciona pero que no están en `game.js`: se porta exactamente lo que hay en el código, no lo que describe el README.
- Audio/efectos de sonido (el original no tiene).
- Cualquier otro cambio a `lib/games.ts` más allá del rename del `id`: `title` ("ROCAS"), `cover` (`cover-rocas`), `best`/`plays` siguen siendo los valores estáticos existentes, no se conectan al score real.
- El texto de ejemplo "Rocas" en el array estático de "Actividad en vivo" de `components/Home.tsx` (SPEC 02) — es un dato de ejemplo sin relación con `game.id`, no se toca.
- Cualquier cambio al flujo de guardado de puntuación (`saveScore` → `localStorage` `av_scores` vía `SessionProvider`, de SPEC 01).
- Tests automatizados (no hay test runner configurado en `package.json`).

---

## Data model

Este spec no introduce estructuras de datos persistidas nuevas; reutiliza `ScoreRow` y `saveScore` de SPEC 01 tal cual. El único cambio a datos existentes es el `id` de un elemento de `GAMES` en `lib/games.ts` (`"rocas"` → `"asteroides"`). El estado interno del juego (nave, asteroides, balas, partículas, score, vidas, nivel) vive solo dentro de `AsteroidsGame` mientras el componente está montado — no se guarda en ningún lado, se pierde al salir de `/jugar/asteroides` (mismo comportamiento que el mock actual).

```ts
// Props de components/AsteroidsGame.tsx
type AsteroidsGameProps = {
  running: boolean; // arranca/detiene el loop y los listeners de teclado
  onStats: (stats: { score: number; lives: number; level: number }) => void;
  onGameOver: (finalScore: number) => void;
};
```

---

## Implementation plan

1. En `lib/games.ts`, cambiar `id: "rocas"` a `id: "asteroides"` en el objeto de `GAMES` con `title: "ROCAS"`. Verificación manual: `npm run dev` y confirmar que `/juegos/asteroides` y `/jugar/asteroides` sirven la ficha y el reproductor de ROCAS (con el mock, todavía sin el juego real), y que `/juegos/rocas` ahora da 404.
2. Crear `components/AsteroidsGame.tsx` (`"use client"`) portando de `references/started-games/02-asteroids/game.js` las clases y funciones de juego (`Bullet`, `Asteroid`, `Ship`, `Particle`, `wrap`/`dist`/`rand`/`randInt`, `spawnAsteroids`, `explode`, `killShip`, `update`, `draw`) dentro de un `useEffect` que crea el loop con `requestAnimationFrame`, sin `drawHUD` ni el overlay de game over del original. Verificación manual: montar `<AsteroidsGame running={true} onStats={console.log} onGameOver={console.log} />` temporalmente en `/jugar/asteroides` (sin quitar aún el mock) y confirmar en el navegador que la nave se mueve con las flechas y dispara con Espacio.
3. Añadir a `AsteroidsGame` las props `running` (efecto que arranca/detiene `requestAnimationFrame` y agrega/remueve los listeners de teclado según su valor) y los callbacks `onStats`/`onGameOver` (invocados desde el loop solo cuando score/vidas/nivel cambian, o cuando `lives` llega a 0). Verificación manual: togglear `running` desde un botón temporal y confirmar que el juego se congela y descongela sin perder posición.
4. Editar `components/PlayerScreen.tsx`: agregar estado `playId` (número, incrementa en `restart()`); condicionar el bloque `.game-arena` — si `game.id === "asteroides"`, renderizar `<AsteroidsGame key={playId} running={!paused && !over} onStats={...} onGameOver={...} />` ocupando el mismo espacio (`position:absolute; inset:0` dentro de `.crt-screen`); para el resto de juegos, mantener el `.game-arena` y el `useEffect` del `setInterval` de puntaje falso exactamente igual que hoy, condicionado a `game.id !== "asteroides"`.
5. Conectar `onStats` a los `useState` existentes de `score`/`lives` y a un nuevo estado `level` (reemplaza el cálculo `Math.floor(score / 2500) + 1` solo para `asteroides`); conectar `onGameOver` a `endGame()` (el mismo handler que ya usa el botón FIN, para que ambos caminos terminen en el mismo modal).
6. Quitar el contenido fijo (`.grid-floor`, `.enemy`, `.player-ship`) de `.game-arena` cuando se renderiza `AsteroidsGame` en su lugar, o envolverlo para que solo aparezca en los demás juegos.
7. Pasada final: `npm run lint` y `npm run build` sin errores; probar en el navegador `/jugar/asteroides` (mover la nave, disparar, romper asteroides de los 3 tamaños, subir de nivel, perder las 3 vidas, guardar la puntuación, "JUGAR DE NUEVO", pausar/reanudar a medio juego, pulsar FIN a medio juego, escribir en el input de iniciales usando las flechas del teclado) y `/jugar/bloque-buster` (confirmar que el mock sigue igual, sin regresiones).

---

## Acceptance criteria

- [x] El objeto de `GAMES` con `title: "ROCAS"` tiene `id: "asteroides"`; `/juegos/asteroides` y `/jugar/asteroides` sirven ese juego, `/juegos/rocas` y `/jugar/rocas` dan 404.
- [x] En `/jugar/asteroides`, el canvas muestra la nave triangular, asteroides poligonales y fondo negro del juego real — no el `.game-arena` con rejilla y enemigos falsos.
- [x] `←`/`→` rotan la nave, `↑` la propulsa, `Espacio` dispara balas, igual que el original.
- [x] Los asteroides grandes se dividen en medianos al ser destruidos, y los medianos en pequeños; el HUD `Puntuación` de la app suma 100/50/20 puntos según el tamaño destruido.
- [x] El HUD `Vidas` baja cuando la nave choca con un asteroide fuera del período de invencibilidad; el HUD `Nivel` sube al limpiar todos los asteroides del nivel actual.
- [x] El canvas no dibuja su propio SCORE/NIVEL/vidas ni una pantalla "GAME OVER" propia — esa información solo vive en el HUD y el modal ya existentes de la app.
- [x] Al llegar a 0 vidas, o al pulsar el botón FIN del HUD, el juego se detiene y aparece el modal existente con la puntuación final real; guardarla funciona igual que hoy (`saveScore` → `localStorage`).
- [x] Pulsar PAUSA congela nave/asteroides/balas en su posición; REANUDAR continúa sin saltos.
- [x] "JUGAR DE NUEVO" reinicia el juego real desde cero (nave al centro, 4 asteroides grandes, score/vidas/nivel en su valor inicial).
- [x] Con el modal de fin de partida abierto, escribir en el input "TUS INICIALES" (incluyendo mover el cursor con las flechas) funciona con normalidad; el juego de fondo no captura esas teclas.
- [x] `/jugar/bloque-buster` (o cualquier otro juego del catálogo) sigue mostrando el `.game-arena` mock con puntaje aleatorio, sin cambios de comportamiento.
- [x] `npm run lint` y `npm run build` terminan sin errores.

---

## Decisions

- **Sí:** renombrar solo el `id` (`"rocas"` → `"asteroides"`) del juego con título "ROCAS" en `lib/games.ts`. El identificador de código pasa a coincidir con el juego real que representa; el título visible, la portada y el resto de campos no cambian porque no hay motivo para tocarlos.
- **Sí:** alcance recortado a este juego únicamente. El resto del catálogo sigue con el mock; una arquitectura genérica para conectar juegos reales se decide cuando haya un segundo caso con el que comparar el patrón.
- **Sí:** adaptar `game.js` a un componente cliente en vez de un iframe. Mantiene el HUD y el modal de guardado ya construidos en `PlayerScreen`/`SessionProvider` como única fuente de verdad, sin duplicar UI ni inventar un canal `postMessage`.
- **Sí:** quitar el HUD dibujado en canvas (`drawHUD`) y el overlay "GAME OVER" del original. Evita mostrar el puntaje dos veces y tener dos flujos de reinicio (Espacio en el canvas vs. botón del modal).
- **Sí:** reinicio del componente completo vía `key={playId}` en vez de un método imperativo `restart()`. Es el patrón idiomático de React para forzar un remount limpio y evita mantener dos rutas de reset sincronizadas a mano.
- **Sí:** unificar pausa y fin de partida en una sola prop `running` que arranca/detiene el `requestAnimationFrame` y los listeners de teclado. Resuelve a la vez la pausa pedida y la captura de teclado del input del modal con un solo mecanismo.
- **Sí:** notificar score/vidas/nivel al padre solo cuando cambian, no en cada frame, para evitar renders innecesarios del HUD de React.
- **No:** renombrar también `title`, `cover` o el texto de ejemplo "Rocas" en `Home.tsx`. Ninguno depende del `id`; tocarlos sería un cambio cosmético no pedido.
- **No:** arquitectura de plugin genérica para futuros juegos reales — descartado para este spec.
- **No:** iframe + `postMessage` — duplicaría el HUD/modal o requeriría reconstruirlos dentro del iframe.
- **No:** controles táctiles — el original es solo teclado; agregarlos sería inventar una interacción no pedida.

---

## Risks

| Risk                                                                                                                                                                        | Mitigation                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cambiar el `id` de `"rocas"` a `"asteroides"` deja sin efecto cualquier enlace o bookmark viejo a `/juegos/rocas` o `/jugar/rocas`                                          | Aceptado: el proyecto está en desarrollo, sin usuarios externos; mismo criterio ya usado en SPEC 02 al mover Biblioteca de `/` a `/biblioteca`. No se agrega redirect.                                                           |
| Los listeners de teclado (`keydown`/`keyup` en `window`) quedan activos si el efecto no limpia bien al desmontar o al cambiar `running`                                     | Se instalan y remueven dentro del mismo `useEffect`, con cleanup atado a `running`; se verifica manualmente saliendo de `/jugar/asteroides` a `/juegos/asteroides` y confirmando que las flechas ya no hacen nada en esa página. |
| `key={playId}` fuerza un remount completo del canvas en cada reinicio, lo que podría notarse como un parpadeo                                                               | Aceptado: el remount es instantáneo (no carga assets externos), mismo costo que ya paga `initGame()` en el original.                                                                                                             |
| La física (colisiones, wrap de bordes) depende de la resolución interna fija 800×600; si en el futuro se busca una resolución realmente responsiva, esos cálculos se rompen | Fuera de este spec: limitación heredada del original, documentada aquí, no se resuelve ahora.                                                                                                                                    |

---

## What is **not** in this spec

- Juego real para cualquier otro juego del catálogo distinto de "ROCAS" (id `asteroides`).
- Arquitectura genérica de "juego real conectable".
- Controles táctiles/móviles.
- Power-ups o tipos de asteroide especiales no presentes en `game.js`.
- Audio.
- Cambios a `title`, `cover`, `best`/`plays` de `lib/games.ts`, al texto de ejemplo de `Home.tsx`, o al flujo de guardado de puntuación de SPEC 01.

Cada uno de estos, si se implementa, va en su propio spec.

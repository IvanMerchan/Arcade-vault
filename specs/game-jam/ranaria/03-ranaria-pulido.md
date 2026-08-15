# SPEC 03 — Pulido visual, tortugas sumergibles y balance de RANARIA

> **Status:** Borrador
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-08-14
> **Objective:** Llevar `RanariaGame` de un tablero funcional a la estética neón/CRT del resto de la plataforma, implementar las tortugas sumergibles que SPEC 01 dejó explícitamente pendientes, relajar la tolerancia del hueco de meta, y fijar los criterios de cierre de esta jam.

---

## Por qué este spec

SPEC 01 deja el `Data model`, el loop y el contrato `PlayableGameProps` completos y jugables, pero con dibujo funcional mínimo (formas sólidas sin glow) y con dos decisiones explícitas marcadas como candidatas a revisar aquí: "tortugas que se sumergen periódicamente... se documenta como candidato explícito para un spec de pulido futuro" y "tolerancia de columna en el hueco de meta... se puede ampliar en SPEC 03 sin cambiar el modelo de datos". SPEC 02 conecta el componente a la plataforma sin tocar su interior. Este spec es exactamente ese "futuro" al que ambos se refieren: no cambia el contrato `PlayableGameProps` ni el camino de integración, solo el contenido de `components/RanariaGame.tsx`.

`app/globals.css` ya define `.crt-screen` (marco 4:3 con viñeta y scanlines) y `TetrisGame` ya probó en producción el patrón de skin "Neon" (`shadowBlur` + `strokeRect` con glow) que este spec reutiliza como referencia directa, adaptado a la paleta `green` de `ranaria` (la fila de `games` ya fija `color: 'green'`, que es la variable `--green` de `app/globals.css`).

---

## Scope

**In:**

- Paleta y glow: recolorear el dibujo de `RanariaGame` para usar `--green` como acento principal (rana, huecos de nenúfar ocupados, borde del tablero), con `--cyan` para el agua, `--yellow` para los coches (variando tono por carril para distinguirlos), y `shadowBlur` + `strokeRect`/`arc` con glow en la rana y los nenúfares ocupados — mismo patrón que la skin Neon de `TetrisGame`.
- Tortugas sumergibles: la mitad de los obstáculos de cada carril de agua (alternados) pasan a ser `kind: "turtle"` en vez de `"log"`, con un ciclo `arriba → advertencia (parpadeo) → sumergida → arriba` de duración fija por fase (`TURTLE_CYCLE = { up: 4, warning: 0.6, down: 1.4 }` segundos). Mientras una tortuga está `"down"`, no cuenta como plataforma válida — si la rana está sobre ella en ese instante, cae al agua igual que si no hubiera nada. La fase `"warning"` es solo visual (parpadeo), la tortuga sigue siendo válida como plataforma en esa fase.
- Los troncos (`kind: "log"`) no cambian de comportamiento — siguen siendo plataformas permanentes mientras estén sobre el agua, como en SPEC 01.
- Tolerancia del hueco de meta: al llegar a `row 0`, la condición de éxito pasa de coincidencia exacta de columna a `Math.abs(frog.col - slotCol) <= 1` contra cualquier hueco vacío — si hay más de un hueco dentro de esa tolerancia, se ocupa el más cercano.
- Efectos de impacto: destello breve de pantalla (`ctx.fillStyle` semitransparente sobre todo el canvas durante ~150ms) al perder una vida (atropello, ahogamiento, o tortuga sumergida bajo la rana), y una pequeña animación de partículas (puntos que se expanden y desvanecen) al ocupar un hueco de nenúfar.
- Interpolación visual del salto: la posición dibujada de la rana se anima suavemente entre celdas (~90ms, easing simple) en vez de saltar de forma instantánea entre `col`/`row` enteros — puramente visual, no cambia `frog.col`/`frog.row` como fuente de verdad lógica ni el timing de colisión (la colisión sigue evaluándose contra la posición lógica, no la interpolada).
- Ajuste de balance tras esta ronda de cambios: reducir el escalado de `laneSpeed(level)` de `0.12` a `0.10` por nivel (el mismo tope `2.5`) para compensar la dificultad añadida por las tortugas sumergibles, de forma que la curva de dificultad total no suba más rápido que en SPEC 01.
- Indicador visual del cronómetro de ronda (barra o arco alrededor del HUD del tablero, dentro del mismo canvas) — dato que hoy solo vive en el estado interno sin ninguna señal visual para el jugador.
- Criterios de cierre de la jam (ver Acceptance criteria): checklist final que confirma que el paquete completo (SPEC 01 + 02 + 03) es jugable de punta a punta con la estética definitiva.

**Out of scope (for future specs):**

- Sonido — ningún juego de la plataforma tiene audio hoy; introducirlo sería la primera vez y merece su propio spec transversal, no uno específico de `ranaria`.
- Controles táctiles/móviles.
- Cambios al contrato `PlayableGameProps`, a `lib/game-registry.ts` o a `PlayerScreen.tsx` — ya cerrados por SPEC 02.
- Nuevos tipos de obstáculo más allá de coches/troncos/tortugas (por ejemplo, aceite/hielo en la autopista) — fuera del brief original de esta jam.
- Modo multijugador o versus.
- Tests automatizados (no hay test runner configurado).

---

## Data model

No se introduce ningún tipo nuevo a nivel de `RanariaState`; se extiende el tipo `obstacles` de `Lane` (definido en SPEC 01) con campos opcionales para el ciclo de las tortugas, y se añade una constante de módulo:

```ts
// components/RanariaGame.tsx — extensión del tipo Lane.obstacles de SPEC 01
type ObstacleKind = "car" | "log" | "turtle";

type Obstacle = {
  x: number;
  width: number;
  kind: ObstacleKind; // "car" en carriles de tráfico; "log" | "turtle" en carriles de agua
  cyclePhase?: "up" | "warning" | "down"; // solo presente si kind === "turtle"
  cycleTimer?: number; // segundos restantes en la fase actual; solo si kind === "turtle"
};
```

Constante de módulo nueva: `TURTLE_CYCLE = { up: 4, warning: 0.6, down: 1.4 }` (segundos por fase). El resto de `RanariaState` (definido en SPEC 01: `lanes`, `frog`, `goalSlots`, `maxProgressRow`, `score`, `lives`, `level`, `roundTimer`, `gameOver`, `gameOverNotified`, `keys`, `justPressed`, `lastTime`) no cambia de forma; `frog` gana únicamente un par de campos de renderizado derivados (posición interpolada), que viven en el mismo `useRef`, no en `useState`, y no participan en ninguna lógica de colisión.

---

## Implementation plan

1. Recolorear el dibujo existente del tablero, carriles, rana y nenúfares con la paleta `--green`/`--cyan`/`--yellow` y añadir `shadowBlur` + glow a la rana y a los nenúfares ocupados, siguiendo el patrón de la skin Neon de `TetrisGame`. Verificación manual: `/jugar/ranaria` se ve coherente con la estética CRT/neón del resto de la plataforma, sin perder legibilidad de carriles/obstáculos.
2. Convertir la mitad (alternada) de los obstáculos de cada carril de agua a `kind: "turtle"` con el ciclo `TURTLE_CYCLE`, y actualizar la lógica de plataforma válida de SPEC 01 para que una tortuga en fase `"down"` no cuente como plataforma. Verificación manual: las tortugas parpadean en la fase de advertencia y se sumergen visualmente; estar sobre una tortuga sumergida hace caer a la rana igual que agua sin plataforma.
3. Relajar la condición de meta a tolerancia `±1` columna, eligiendo el hueco vacío más cercano cuando hay más de uno dentro de rango. Verificación manual: llegar a una columna adyacente (no exacta) a un nenúfar vacío también lo ocupa; si dos huecos están dentro de tolerancia, se ocupa el más cercano.
4. Añadir el destello de pantalla al perder una vida y la animación de partículas al ocupar un nenúfar, ambos dibujados dentro del mismo `<canvas>` sin overlays DOM nuevos. Verificación manual: cada fallo (atropello, ahogamiento, tortuga sumergida, timeout) produce el destello; cada nenúfar ocupado produce las partículas.
5. Añadir la interpolación visual del salto de la rana (posición dibujada suavizada entre celdas, ~90ms) sin tocar `frog.col`/`frog.row` como fuente de verdad para colisión. Verificación manual: el salto se ve suave a simple vista; la detección de colisión sigue siendo tan precisa como en SPEC 01 (comparar contra el comportamiento antes de este paso).
6. Añadir el indicador visual del cronómetro de ronda dentro del canvas, y ajustar `laneSpeed(level)` de `0.12` a `0.10` por nivel. Verificación manual: el indicador de tiempo baja de forma visible y sincronizada con `roundTimer`; la sensación de dificultad en niveles 3-5 no es más dura que la versión de SPEC 01 pese a las tortugas nuevas (comparación manual jugando ambas versiones).
7. Pasada final de cierre de jam: `npm run lint` y `npm run build` sin errores; recorrido manual completo de `/jugar/ranaria` (cruzar tráfico y río con troncos y tortugas en todas sus fases, usar la tolerancia de columna en el nenúfar, completar al menos 3 rondas para ver la curva de nivel, perder las 3 vidas de cada forma posible, guardar puntuación, "JUGAR DE NUEVO", pausar/reanudar) y confirmación de cero regresiones en `/jugar/asteroides`, `/jugar/caida` y un mock restante.

---

## Acceptance criteria

- [ ] La estética de `/jugar/ranaria` usa la paleta `--green`/`--cyan`/`--yellow` con glow (`shadowBlur`) en la rana y los nenúfares ocupados, coherente con `.crt-screen` y con la skin Neon ya validada en `TetrisGame`.
- [ ] Cada carril de agua tiene troncos permanentes y tortugas con ciclo `arriba → advertencia → sumergida`; una tortuga sumergida bajo la rana la hace caer al agua.
- [ ] Llegar a `row 0` dentro de `±1` columna de un nenúfar vacío lo ocupa; si hay varios dentro de tolerancia, se ocupa el más cercano.
- [ ] Perder una vida produce un destello de pantalla perceptible; ocupar un nenúfar produce una animación de partículas breve.
- [ ] El salto de la rana se ve interpolado/suave entre celdas, sin afectar la precisión de la detección de colisión.
- [ ] Un indicador visual dentro del canvas refleja el cronómetro de ronda en tiempo real.
- [ ] La curva de dificultad con tortugas activas no se siente más punitiva que la versión de SPEC 01 sin ellas (verificado por recorrido manual comparativo).
- [ ] El canvas sigue sin dibujar su propio HUD de puntuación/vidas/nivel ni una pantalla de game over propia — toda esa UI sigue siendo de `PlayerScreen`.
- [ ] Recorrido manual completo de cierre de jam (jugar de punta a punta, perder de cada forma posible, completar rondas, guardar puntuación) sin errores ni comportamiento inesperado.
- [ ] `/jugar/asteroides`, `/jugar/caida` y al menos un juego con mock restante siguen funcionando exactamente igual que antes de este spec.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

---

## Decisions

- **Sí:** implementar las tortugas sumergibles ahora — SPEC 01 las dejó explícitamente marcadas como candidato de pulido, no las descartó por falta de valor de juego, sino para no complicar el MVP. Este es el spec correcto para esa complejidad.
- **Sí:** relajar la tolerancia del hueco de meta a `±1` — SPEC 01 marcó la coincidencia exacta como "puede sentirse muy estricto" y explícitamente permitió ampliarla aquí sin tocar el modelo de datos.
- **Sí:** reducir el escalado de `laneSpeed` de `0.12` a `0.10` al mismo tiempo que se añaden las tortugas — mantiene la dificultad total percibida estable en vez de acumular dos aumentos de dificultad (tortugas + velocidad) en la misma entrega.
- **Sí:** la interpolación del salto es puramente visual, sobre una posición derivada separada de `frog.col`/`frog.row` — mantiene la colisión exacta y determinista de SPEC 01 intacta, evitando el bug clásico de "animación bonita, hitbox rota".
- **No:** sonido. Ningún juego de la plataforma lo tiene hoy; añadirlo aquí sería la primera implementación de audio de todo Arcade Vault y merece su propio spec transversal (research de Web Audio API, convención de assets, etc.), no uno colgado de esta jam.
- **No:** nuevos tipos de obstáculo (aceite, hielo, power-ups) — no estaban en el brief original de la jam ("Frogger clásico") y ampliarían el alcance más allá de pulir lo ya diseñado.
- **No:** tocar `PlayableGameProps`, `lib/game-registry.ts` o `PlayerScreen.tsx` — ya cerrados por SPEC 02; este spec es estrictamente interior a `RanariaGame`.

---

## Risks

| Risk                                                                                                                                                            | Mitigation                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Las tortugas sumergibles añaden un segundo tipo de fallo en el río que puede sentirse injusto si el ciclo es difícil de leer                                    | Fase `"warning"` explícita (parpadeo) antes de sumergir, con duración fija (`0.6s`) pensada para dar tiempo de reacción                               |
| Reducir `laneSpeed` de `0.12` a `0.10` por nivel podría, en combinación con las tortugas, hacer los niveles altos más fáciles de lo esperado en vez de estables | El paso 6 del plan pide explícitamente una comparación manual jugando ambas versiones antes de cerrar el spec, no solo una intuición numérica         |
| La interpolación visual del salto podría desincronizarse de la posición lógica si el jugador salta muy rápido en sucesión                                       | La interpolación es una variable de renderizado independiente que siempre re-apunta a la posición lógica actual en cada salto nuevo, nunca se acumula |
| El destello de pantalla y las partículas compiten visualmente con el glow ya añadido en el paso 1                                                               | Duración corta (~150ms) y opacidad baja, verificado a simple vista en el paso 4 antes de continuar                                                    |

---

## What is **not** in this spec

- Sonido y controles táctiles/móviles.
- Nuevos tipos de obstáculo fuera de coches/troncos/tortugas.
- Cualquier cambio a `PlayableGameProps`, `lib/game-registry.ts` o `PlayerScreen.tsx`.
- Modo multijugador o versus.
- Tests automatizados (no hay test runner configurado en `package.json`).

Cada uno de estos, si se implementa, va en su propio spec.

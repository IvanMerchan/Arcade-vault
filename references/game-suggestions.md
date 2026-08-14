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

---

## Ronda 1 — 2026-08-14

Primera ronda real del agente `game-planner`. El `references/game-suggestions-todo.md` previo era un placeholder poblado a mano ("Sin evaluar" en todas las filas), así que esta ronda es la primera evaluación de fondo — no hay `Descartado` previo que reproponer.

### Estado verificado

- `lib/game-registry.ts`: `isPlayable()` cubre `{"asteroides", "caida"}` — sin cambios desde el snapshot de `implemented-games.md`.
- `games` (Supabase, 8 filas) vs `isPlayable()`: 6 mocks pendientes — `bloque-buster` (ARCADE), `serpentina` (ARCADE), `gloton` (ARCADE), `invasores` (SHOOTER), `ranaria` (ARCADE), `duelo-pixel` (VERSUS).
- `references/started-games/`: solo `02-asteroids` y `03-tetris` tienen `game.js` (ambos ya portados). `04-arkanoid` solo contiene `assets/sounds/` — sin `game.js`, no cuenta como porte listo. **No hay ninguna población "Porte disponible" utilizable en esta ronda.**
- Leídas las columnas `short`/`long` de `games` para inferir la mecánica real detrás de cada mock: `bloque-buster` = Breakout/Arkanoid, `serpentina` = Snake, `gloton` = Pac-Man, `invasores` = Space Invaders, `ranaria` = Frogger, `duelo-pixel` = Pong ("Modo solitario contra la CPU o partida local a dos jugadores" — el propio catálogo ya insinúa un modo 1P).
- Categorías sin ningún juego jugable real: **ARCADE** (4 mocks) y **VERSUS** (1 mock, con bandera roja de puntuación).

### Tabla de candidatos

| Candidato       | Fuente                                 | Categoría | Encaje                                                                                                                                                 | Coste                                                                              | Riesgo                                                     | Veredicto                                             |
| --------------- | --------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| `serpentina`    | Catálogo (mock) — Snake                 | ARCADE    | Score creciente natural (comida comida), game over inequívoco (choque con pared/cola). `lives` se fija en 1 (declarado explícitamente), `level` se deriva de longitud/velocidad. Llena el hueco ARCADE. Patrón grid-por-tick ya validado por `caida`. | Bajo — sin fuente portable, pero mecánica trivial, ~450-550 líneas, sin IA, sin física continua | Bajo                                                          | **Recomendado**                                       |
| `bloque-buster` | Catálogo (mock) — Breakout/Arkanoid     | ARCADE    | Vidas y niveles naturales (bolas perdidas / bloques limpiados), score creciente por bloque. Llena el mismo hueco ARCADE. Física continua ya validada por `asteroides`.                                                                          | Medio — colisión bola/paleta/bloques con física continua, más diseño de patrones de nivel (el propio `long` del catálogo promete "cada nivel reorganiza la grilla") | Bajo-Medio                                                    | Candidato fuerte, segunda opción                      |
| `duelo-pixel`   | Catálogo (mock) — Pong                  | VERSUS    | Mecánica más simple de las seis (2 palas + pelota), pero el leaderboard es de un solo jugador. La descripción de catálogo ya ofrece un modo "solitario contra la CPU" que resuelve la bandera roja: solo ese modo puntúa; el 2P local, si se implementa, no guarda score (o queda fuera de esta iteración). Llenaría el hueco VERSUS. | Bajo mecánicamente, pero con una decisión de alcance pendiente que `/add-game` debe fijar explícitamente | Medio — bandera roja explícita de puntuación / alcance 1P vs 2P | Interesante, pero exige que el spec cierre el alcance |
| `ranaria`       | Catálogo (mock) — Frogger               | ARCADE    | Vidas y niveles naturales (atropellos, cruces), score por avance/tiempo. Encaje técnico correcto pero mismo hueco ARCADE ya cubierto por candidatos más baratos.                                                                                | Medio — carriles de tráfico + río con troncos a la deriva, timing más fino          | Medio                                                         | Descartado por ahora — redundante frente a `serpentina`/`bloque-buster` en la misma categoría |
| `invasores`     | Catálogo (mock) — Space Invaders        | SHOOTER   | Mecánica clara, encaje técnico bueno, pero SHOOTER ya tiene `asteroides` real — no aporta diversidad de catálogo.                                                                                                                                | Medio                                                                              | Bajo                                                          | Descartado por ahora — prioridad baja por redundancia de categoría |
| `gloton`        | Catálogo (mock) — Pac-Man               | ARCADE    | Encaje conceptual bueno (vidas/niveles naturales) pero requiere laberinto + 4 fantasmas con IA de persecución + estado de power-pellet — se sale del presupuesto de ~500-700 líneas sin recortar alcance.                                       | Alto                                                                               | Medio-Alto                                                    | Descartado por ahora — coste desproporcionado frente al resto |
| `04-arkanoid`   | `references/started-games/04-arkanoid` | —         | Carpeta solo tiene `assets/sounds/`, sin `game.js` — no es un porte listo y no reduce el coste de `bloque-buster` frente a construirlo desde cero.                                                                                              | —                                                                                   | —                                                              | No es un candidato independiente — mismo `id` de catálogo que `bloque-buster`, sin fuente utilizable |

### Recomendación

**`serpentina`.** Es el único candidato sin ninguna ambigüedad pendiente: puntuación, vidas y nivel se derivan de forma directa y natural de la mecánica (comida/longitud/velocidad), el game over es inequívoco, y no exige ninguna decisión de alcance como sí exige `duelo-pixel` (bandera roja VERSUS) o `bloque-buster` (diseño de niveles de bloques). Llena el hueco de categoría ARCADE — hoy sin ningún juego jugable real — con el menor riesgo y coste relativo de los seis mocks evaluados, y reutiliza el patrón grid-por-tick que `caida` ya validó en producción.

### Estados

| Candidato       | Estado       |
| --------------- | ------------ |
| `serpentina`    | `Aceptado`   |
| `bloque-buster` | `Propuesto`  |
| `duelo-pixel`   | `Propuesto`  |
| `ranaria`       | `Descartado` |
| `invasores`     | `Descartado` |
| `gloton`        | `Descartado` |
| `04-arkanoid`   | `Propuesto` (no independiente de `bloque-buster`) |

---

## Ronda 2 — 2026-08-14

El usuario pidió ampliar el ranking a **20 candidatos** en una sola pasada, cubriendo las tres poblaciones de la Fase 1: los mocks de catálogo pendientes (`bloque-buster`, `duelo-pixel`, `invasores`, `ranaria`, `gloton`), y 14 ideas nuevas fuera de catálogo generadas en paralelo por tres focos de investigación (arcade/acción, puzzle/casual, versus/otros géneros). Consolidación hecha por el orquestador a partir de esos cuatro sub-análisis; esta sección persiste el resultado ya decidido.

### Cambio de alcance frente a Ronda 1

`ranaria`, `invasores` y `gloton` reaparecen aquí pese a haber sido `Descartado` en Ronda 1. **No cambió su encaje ni su riesgo** — siguen siendo redundantes en categoría (`ranaria`/`gloton` compiten con `serpentina`/`bloque-buster` en ARCADE, `invasores` con `asteroides` en SHOOTER) o desproporcionadamente costosos (`gloton`, IA de fantasmas). Lo que cambió es el **alcance de la ronda**: Ronda 1 debía producir una única recomendación inmediata; Ronda 2 debía producir la cola completa de 20 candidatos para planificación a largo plazo. Se documentan explícitamente en sus posiciones bajas (#9, #12, #18) para que sesiones futuras no los reevalúen desde cero, no porque haya un argumento nuevo a su favor.

### Nota de normalización de ids

Dos nombres nuevos llegaron con tilde (`laberinto-neón`, `saltarín-pixel`). Por la regla dura de `id` en kebab-case, se normalizan a `laberinto-neon` y `saltarin-pixel` en la tabla; el nombre con tilde queda solo como referencia de display/título si se implementan.

### Tabla de candidatos (20, de mayor a menor prioridad)

| # | Candidato | Fuente | Categoría | Encaje | Coste | Riesgo | Veredicto |
| - | --------- | ------ | --------- | ------ | ----- | ------ | --------- |
| 1 | `serpentina` | Catálogo (mock) — Snake | ARCADE | Ya era el pick #1 de Ronda 1; sin ambigüedad de score/vidas/nivel/game-over; llena hueco ARCADE | Bajo | Bajo | **Recomendado — se mantiene el pick inmediato** |
| 2 | `bloque-buster` | Catálogo (mock) — Breakout/Arkanoid | ARCADE | Vidas/niveles naturales; física continua ya validada por `asteroides` | Medio | Bajo-Medio | Segunda opción |
| 3 | `esquiva-meteoros` | Nuevo (foco arcade/acción) | ARCADE | Mecánica de esquive con score por tiempo/distancia sobrevivido, sin física compleja ni IA — encaje directo con el patrón de `asteroides` reducido | Bajo | Muy bajo | Tercera opción, riesgo más bajo de todo el listado nuevo |
| 4 | `duelo-pixel` | Catálogo (mock) — Pong | VERSUS | Llena el único hueco VERSUS, pero exige que el spec fije explícitamente que solo el modo 1P-vs-CPU puntúa (bandera roja VERSUS de la Fase 3) | Bajo (mecánico) | Bajo, condicionado a esa decisión de alcance | Interesante, pendiente de decisión de alcance en el spec |
| 5 | `carrera-neon` | Nuevo (foco versus/otros) — carreras | VERSUS/carreras | Mismo tipo de bandera roja que `duelo-pixel`: si se plantea 2P local, el spec debe fijar qué puntúa (tiempo del ganador vs ambos tiempos) | Medio | Bajo-Medio | Alternativa VERSUS si `duelo-pixel` no avanza |
| 6 | `laberinto-neon` | Nuevo (foco arcade/acción) | ARCADE | Recolección + persecución simple en grid, score por ítems/tiempo, patrón grid-tick reutilizable de `caida`/`serpentina` | Bajo | Bajo | Buena alternativa ARCADE de bajo riesgo |
| 7 | `memoriax` | Nuevo (foco puzzle/casual) — parejas | PUZZLE | Score por aciertos/tiempo, sin física ni IA, game over claro (tablero completo o límite de tiempo) | Bajo | Muy bajo | Candidato PUZZLE más barato del listado nuevo |
| 8 | `duelo-esgrima` | Nuevo (foco versus/otros) | VERSUS | Mismo patrón de bandera roja VERSUS que `duelo-pixel`/`carrera-neon` — requiere resolución explícita de scoring en el spec | Medio | Bajo | Tercera alternativa VERSUS |
| 9 | `invasores` | Catálogo (mock) — Space Invaders | SHOOTER | Mecánica clara, pero SHOOTER ya cubierto por `asteroides` — sin aporte de diversidad de catálogo (reevaluado, sin cambios desde Ronda 1) | Medio | Bajo | Redundante por categoría |
| 10 | `cascada` | Nuevo (foco puzzle/casual) — match-3 | PUZZLE | Score natural por combos, pero requiere lógica de matching/cascada más elaborada que `memoriax`/`caida` | Medio | Medio | Viable, más caro que otras opciones PUZZLE |
| 11 | `codigo-secreto` | Nuevo (foco puzzle/casual) — Mastermind | PUZZLE | Score por intentos/tiempo, mecánica simple pero con UI de feedback (pegs) algo más compleja que el resto de PUZZLE nuevos | Medio | Bajo-Medio | Viable, prioridad media |
| 12 | `ranaria` | Catálogo (mock) — Frogger | ARCADE | Vidas/niveles naturales pero redundante frente a `serpentina`/`bloque-buster`/`esquiva-meteoros`/`laberinto-neon` en ARCADE (reevaluado, sin cambios desde Ronda 1) | Medio | Medio | Redundante por categoría, cola de espera |
| 13 | `hexagiro` | Nuevo (foco puzzle/casual) — tipo 2048 | PUZZLE | Score por fusiones, pero requiere lógica de grid con animaciones de merge más fina que el resto de PUZZLE del listado | Medio | Medio | Viable, coste medio |
| 14 | `ritmo-bit` | Nuevo (foco arcade/acción) — ritmo | ARCADE | Score por precisión de timing, requiere sincronización audio/input que ningún juego actual de la plataforma tiene todavía | Medio | Medio | Introduce una mecánica nueva (timing musical), coste no trivial |
| 15 | `saltarin-pixel` | Nuevo (foco arcade/acción) — plataformas (display: "Saltarín Pixel") | ARCADE | Score por altura/distancia, pero plataformas con física de salto y colisión de nivel es más trabajo que el resto de ARCADE del listado | Medio | Medio | Viable, coste medio |
| 16 | `tunel-veloz` | Nuevo (foco arcade/acción) | ARCADE | Score por distancia/tiempo sobrevivido en scroll continuo, colisión con obstáculos — similar en coste a `saltarin-pixel` | Medio | Medio | Viable, coste medio |
| 17 | `laberinto-express` | Nuevo (foco puzzle/casual) — procedural | PUZZLE | Generación procedural de laberintos añade complejidad algorítmica no presente en ningún juego actual de la plataforma | Medio-Alto | Medio-Alto | Coste más alto que el resto de PUZZLE del listado |
| 18 | `gloton` | Catálogo (mock) — Pac-Man | ARCADE | Encaje conceptual bueno pero requiere laberinto + IA de persecución de 4 fantasmas + power-pellets, fuera del presupuesto de ~500-700 líneas (reevaluado, sin cambios desde Ronda 1) | Alto | Medio-Alto | Coste desproporcionado, cola de espera |
| 19 | `rescate-vertical` | Nuevo (foco arcade/acción) — plataformas verticales | ARCADE | Score por altura alcanzada, similar a `saltarin-pixel` pero con scroll vertical continuo y generación de plataformas — más superficie de física | Alto | Medio-Alto | Coste alto, redundante en subgénero con `saltarin-pixel` |
| 20 | `boxeo-8bit` | Nuevo (foco versus/otros) — simulación de combate | VERSUS | Además de la bandera roja VERSUS estándar (qué puntúa, ¿solo ganador?), añade simulación de combate con estados/combos — el más complejo de los VERSUS propuestos | Alto | Medio-Alto | El VERSUS más caro y arriesgado del listado |

### Descartado de esta ronda (fuera del top 20)

| Candidato | Fuente | Categoría | Motivo del descarte |
| --------- | ------ | --------- | -------------------- |
| `subasta-caotica` | Nuevo (foco versus/otros) — simulación de gestión | — | Modelo de score menos directo que los 20 anteriores (puntuación de gestión/subasta no se traduce en un número creciente simple) y mayor riesgo de alcance; se anota para reconsiderar si en el futuro cambian las restricciones de scoring de la plataforma |

### Recomendación

**`serpentina`** se mantiene como pick inmediato — ninguno de los 14 candidatos nuevos ni la reevaluación de los mocks pendientes superó su combinación de coste bajo, riesgo bajo y cero ambigüedad de scoring/game-over. `esquiva-meteoros` emerge como la mejor idea nueva (#3, riesgo muy bajo) y `bloque-buster` sigue como segunda opción natural dentro del catálogo ya sembrado.

### Estados

| Candidato | Estado |
| --------- | ------ |
| `serpentina` | `Aceptado` |
| `bloque-buster` | `Propuesto` |
| `esquiva-meteoros` | `Propuesto` |
| `duelo-pixel` | `Propuesto` |
| `carrera-neon` | `Propuesto` |
| `laberinto-neon` | `Propuesto` |
| `memoriax` | `Propuesto` |
| `duelo-esgrima` | `Propuesto` |
| `invasores` | `Descartado` |
| `cascada` | `Propuesto` |
| `codigo-secreto` | `Propuesto` |
| `ranaria` | `Descartado` |
| `hexagiro` | `Propuesto` |
| `ritmo-bit` | `Propuesto` |
| `saltarin-pixel` | `Propuesto` |
| `tunel-veloz` | `Propuesto` |
| `laberinto-express` | `Propuesto` |
| `gloton` | `Descartado` |
| `rescate-vertical` | `Propuesto` |
| `boxeo-8bit` | `Propuesto` |
| `subasta-caotica` | `Descartado` |

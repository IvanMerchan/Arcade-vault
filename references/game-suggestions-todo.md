# Próximo juego a implementar — ranking vigente

Generado por el agente `game-planner` (`.claude/agents/game-planner.md`). Este archivo se **reescribe completo** en cada ronda — el histórico de decisiones vive en `references/game-suggestions.md`. Última ronda: Ronda 2, 2026-08-14 (ampliación a 20 candidatos a petición del usuario).

## Estado verificado en esta ronda

- `isPlayable()` (`lib/game-registry.ts`): `{"asteroides", "caida"}` — sin cambios.
- `games` (Supabase, 8 filas): sin colisión de id/título con ninguno de los 14 candidatos nuevos de esta ronda.
- `references/started-games/`: solo `02-asteroids` y `03-tetris` tienen `game.js` listo (ambos ya portados). `04-arkanoid` solo tiene `assets/sounds/`, sin `game.js` — no es un porte utilizable.
- Categorías sin ningún juego jugable real: **ARCADE** y **VERSUS**.
- `ranaria`, `invasores`, `gloton` reaparecen en esta ronda pese a `Descartado` en Ronda 1 — no cambió su encaje/riesgo, cambió el alcance de la ronda (de "una recomendación" a "cola completa de 20"). Ver detalle en `references/game-suggestions.md` § Ronda 2.
- Dos ids llegaron con tilde y se normalizaron a kebab-case ASCII: `laberinto-neón` → `laberinto-neon`, `saltarín-pixel` → `saltarin-pixel`.

## Ranking (20 candidatos, de mayor a menor prioridad)

| # | Candidato | Fuente | Categoría | Encaje | Coste | Riesgo | Veredicto |
| - | --------- | ------ | --------- | ------ | ----- | ------ | --------- |
| 1 | `serpentina` | Catálogo (mock) — Snake | ARCADE | Sin ambigüedad de score/vidas/nivel/game-over; llena hueco ARCADE; patrón grid-tick ya validado por `caida` | Bajo | Bajo | **Recomendado — siguiente a implementar** |
| 2 | `bloque-buster` | Catálogo (mock) — Breakout/Arkanoid | ARCADE | Vidas/niveles naturales; física continua ya validada por `asteroides` | Medio | Bajo-Medio | Segunda opción |
| 3 | `esquiva-meteoros` | Nuevo (arcade/acción) | ARCADE | Score por tiempo/distancia sobrevivido, sin física compleja ni IA | Bajo | Muy bajo | Tercera opción, riesgo mínimo del listado nuevo |
| 4 | `duelo-pixel` | Catálogo (mock) — Pong | VERSUS | Llena el hueco VERSUS; exige que el spec fije que solo 1P-vs-CPU puntúa | Bajo (mecánico) | Bajo, condicionado a esa decisión | Pendiente de decisión de alcance en el spec |
| 5 | `carrera-neon` | Nuevo (versus/otros) — carreras | VERSUS | Misma bandera roja que `duelo-pixel`: el spec debe fijar qué puntúa en 2P local | Medio | Bajo-Medio | Alternativa VERSUS si `duelo-pixel` no avanza |
| 6 | `laberinto-neon` | Nuevo (arcade/acción) | ARCADE | Recolección/persecución en grid, patrón grid-tick reutilizable | Bajo | Bajo | Alternativa ARCADE de bajo riesgo |
| 7 | `memoriax` | Nuevo (puzzle/casual) — parejas | PUZZLE | Score por aciertos/tiempo, sin física ni IA, game over claro | Bajo | Muy bajo | Candidato PUZZLE más barato del listado |
| 8 | `duelo-esgrima` | Nuevo (versus/otros) | VERSUS | Misma bandera roja VERSUS estándar, requiere resolución explícita en el spec | Medio | Bajo | Tercera alternativa VERSUS |
| 9 | `invasores` | Catálogo (mock) — Space Invaders | SHOOTER | SHOOTER ya cubierto por `asteroides` — sin aporte de diversidad | Medio | Bajo | Redundante por categoría |
| 10 | `cascada` | Nuevo (puzzle/casual) — match-3 | PUZZLE | Score natural por combos, lógica de matching/cascada más elaborada | Medio | Medio | Viable, más caro que otras opciones PUZZLE |
| 11 | `codigo-secreto` | Nuevo (puzzle/casual) — Mastermind | PUZZLE | Score por intentos/tiempo, UI de feedback (pegs) algo más compleja | Medio | Bajo-Medio | Viable, prioridad media |
| 12 | `ranaria` | Catálogo (mock) — Frogger | ARCADE | Vidas/niveles naturales pero redundante frente a otros ARCADE ya listados | Medio | Medio | Redundante por categoría |
| 13 | `hexagiro` | Nuevo (puzzle/casual) — tipo 2048 | PUZZLE | Score por fusiones, lógica de grid con animación de merge | Medio | Medio | Viable, coste medio |
| 14 | `ritmo-bit` | Nuevo (arcade/acción) — ritmo | ARCADE | Score por precisión de timing; sincronización audio/input inédita en la plataforma | Medio | Medio | Mecánica nueva, coste no trivial |
| 15 | `saltarin-pixel` | Nuevo (arcade/acción) — plataformas | ARCADE | Score por altura/distancia; física de salto y colisión de nivel | Medio | Medio | Viable, coste medio |
| 16 | `tunel-veloz` | Nuevo (arcade/acción) | ARCADE | Score por distancia/tiempo en scroll continuo; similar coste a `saltarin-pixel` | Medio | Medio | Viable, coste medio |
| 17 | `laberinto-express` | Nuevo (puzzle/casual) — procedural | PUZZLE | Generación procedural de laberintos, complejidad algorítmica inédita | Medio-Alto | Medio-Alto | Coste más alto que el resto de PUZZLE |
| 18 | `gloton` | Catálogo (mock) — Pac-Man | ARCADE | Laberinto + IA de 4 fantasmas + power-pellets, fuera de presupuesto de líneas | Alto | Medio-Alto | Coste desproporcionado |
| 19 | `rescate-vertical` | Nuevo (arcade/acción) — plataformas verticales | ARCADE | Score por altura; scroll vertical y generación de plataformas | Alto | Medio-Alto | Coste alto, redundante en subgénero con `saltarin-pixel` |
| 20 | `boxeo-8bit` | Nuevo (versus/otros) — simulación de combate | VERSUS | Bandera roja VERSUS + simulación de combate con estados/combos | Alto | Medio-Alto | El VERSUS más caro y arriesgado del listado |

### Fuera del top 20

- `subasta-caotica` (nuevo, versus/otros, simulación de gestión) — **Descartado**: modelo de score menos directo que los 20 anteriores; reconsiderar solo si cambian las restricciones de scoring de la plataforma.
- `04-arkanoid` (`references/started-games/04-arkanoid`) — no es candidato independiente, solo tiene `assets/sounds/` sin `game.js`; mismo id de catálogo que `bloque-buster`.

## Recomendación

**`serpentina`.** Se mantiene como pick inmediato tras evaluar los 20 candidatos: ningún candidato nuevo ni la reevaluación de los mocks pendientes superó su combinación de coste bajo, riesgo bajo y cero ambigüedad de scoring/game-over. Llena el hueco de categoría ARCADE (hoy sin ningún juego jugable real) y reutiliza el patrón grid-por-tick que `caida` ya probó en producción.

**Siguiente paso:** `/add-game serpentina`

Razonamiento completo, tabla íntegra y estados de esta ronda en `references/game-suggestions.md` (sección "Ronda 2 — 2026-08-14").

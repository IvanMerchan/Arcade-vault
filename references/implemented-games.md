# Juegos implementados

Catálogo leído en vivo de la tabla `games` (+ vista `game_stats`) de Supabase. Los 9 están en el catálogo y tienen leaderboard real; solo 3 tienen un componente de juego jugable de verdad (`lib/game-registry.ts`) — el resto usa el arena mock de `PlayerScreen` (puntos aleatorios por `setInterval`).

Nota: `ranaria` (id `ranaria`, sort_order 6) es un juego de cruce de carretera/río sin implementar todavía — mismo género que `frogger`, coexisten a propósito (decisión explícita al implementar SPEC frogger/01-frogger-core; ver `specs/game-jam/ranaria/` si se retoma).

## Jugables (loop real)

| id           | Título  | Categoría | Componente                       | Fuente portada                          |
| ------------ | ------- | --------- | --------------------------------- | ---------------------------------------- |
| `asteroides` | ROCAS   | SHOOTER   | `components/AsteroidsGame.tsx`    | `references/started-games/02-asteroids`  |
| `caida`      | CAÍDA   | PUZZLE    | `components/TetrisGame.tsx`       | `references/started-games/03-tetris`     |
| `frogger`    | FROGGER | ARCADE    | `components/FroggerGame.tsx`      | Construido desde cero (SPEC frogger/01)  |

## Catálogo completo

| # | id             | Título        | Categoría | Color    | Mejor puntuación | Partidas |
| - | -------------- | ------------- | --------- | -------- | ----------------: | -------: |
| 0 | `bloque-buster`| BLOQUE BUSTER | ARCADE    | cyan     | 265,726            | 12       |
| 1 | `caida`        | CAÍDA         | PUZZLE    | magenta  | 278,417            | 13       |
| 2 | `serpentina`   | SERPENTINA    | ARCADE    | green    | 269,985            | 12       |
| 3 | `gloton`       | GLOTÓN        | ARCADE    | yellow   | 278,331            | 12       |
| 4 | `invasores`    | INVASORES     | SHOOTER   | green    | 274,072            | 12       |
| 5 | `asteroides`   | ROCAS         | SHOOTER   | yellow   | 269,985            | 12       |
| 6 | `ranaria`      | RANARIA       | ARCADE    | green    | 278,245            | 12       |
| 7 | `duelo-pixel`  | DUELO PIXEL   | VERSUS    | cyan     | 278,759            | 12       |
| 8 | `frogger`      | FROGGER       | ARCADE    | green    | —                  | 0        |

---

_Fuente: tabla `games` + vista `game_stats` (Supabase, proyecto `grgkpgfilsyoxkniyzce`) y `lib/game-registry.ts`. Generado 2026-08-15._

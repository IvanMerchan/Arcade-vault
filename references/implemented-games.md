# Juegos implementados

Catálogo leído en vivo de la tabla `games` (+ vista `game_stats`) de Supabase. Los 8 están en el catálogo y tienen leaderboard real; solo 2 tienen un componente de juego jugable de verdad (`lib/game-registry.ts`) — el resto usa el arena mock de `PlayerScreen` (puntos aleatorios por `setInterval`).

## Jugables (loop real)

| id           | Título | Categoría | Componente                       | Fuente portada                          |
| ------------ | ------ | --------- | --------------------------------- | ---------------------------------------- |
| `asteroides` | ROCAS  | SHOOTER   | `components/AsteroidsGame.tsx`    | `references/started-games/02-asteroids`  |
| `caida`      | CAÍDA  | PUZZLE    | `components/TetrisGame.tsx`       | `references/started-games/03-tetris`     |

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

---

_Fuente: tabla `games` + vista `game_stats` (Supabase, proyecto `grgkpgfilsyoxkniyzce`) y `lib/game-registry.ts`. Generado 2026-08-14._

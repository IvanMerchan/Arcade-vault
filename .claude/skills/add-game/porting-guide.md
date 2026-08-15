# Guía técnica: conectar un juego real a Arcade Vault

Referencia que el skill `/add-game` (mismo directorio) lee al diseñar un spec. Describe cómo `components/AsteroidsGame.tsx` conecta con `PlayerScreen` y el leaderboard hoy, y cómo debe generalizarse para un segundo juego. No es código para copiar tal cual en la app — es la forma que el spec generado debe describir con nombres de archivo y líneas concretas.

---

## 1. El contrato del componente jugable

Todo juego real implementa la misma interfaz, ya validada por `components/AsteroidsGame.tsx`:

```ts
type GameStats = { score: number; lives: number; level: number };

type PlayableGameProps = {
  running: boolean; // arranca/detiene el loop y los listeners de teclado
  onStats: (stats: GameStats) => void; // solo cuando el valor realmente cambia, no por frame
  onGameOver: (finalScore: number) => void; // una sola vez, con guard interno
  skin: GameSkin; // aspecto visual activo (lib/game-skins.ts) — se refleja en un
  // useRef, nunca entra en las deps del efecto principal ni en key={playId}
};
```

- `running` lo calcula `PlayerScreen` como `!paused && !over`. Al pasar a `false` se cancela el `requestAnimationFrame` y se remueven los listeners de `keydown`/`keyup` en `window` — esto es lo que permite escribir en el input "TUS INICIALES" sin que el juego capture las flechas.
- `onStats` se compara contra el último valor reportado (`lastStatsRef`) antes de llamar al callback.
- `onGameOver` se dispara una única vez por partida, protegido por un flag tipo `gameOverNotified` en el estado del juego.
- El componente **no** dibuja su propio HUD ni una pantalla de game over — esa UI ya existe en `PlayerScreen` (HUD superior + modal de fin de partida).

## 2. Anatomía interna del componente

Patrón fijado por `AsteroidsGame.tsx` (486 líneas), que cualquier juego nuevo repite:

- `"use client"`, constantes `const W = 800; const H = 600;` y funciones utilitarias a nivel de módulo.
- Clases de entidades (`Ship`, `Bullet`, etc.) también a nivel de módulo, cada una con `draw(ctx: CanvasRenderingContext2D)` explícito — el contexto ya no es un global, es un parámetro.
- Todo el estado mutable vive en **un solo `useRef<GameState>`**, nunca en `useState` (evita re-renders en cada uno de los ~60 frames/s):

  ```ts
  type GameState = {
    /* entidades, score, lives, level, state de ciclo de vida */
    keys: Record<string, boolean>;
    justPressed: Record<string, boolean>;
    lastTime: number | null;
    gameOverNotified: boolean;
  };
  const gameRef = useRef<GameState | null>(null);
  ```

- Los callbacks (`onStats`, `onGameOver`) se reflejan en sus propios refs, actualizados por un `useEffect` separado — así el efecto principal del loop depende únicamente de `[running]` y no se re-suscribe en cada render del padre.
- El loop principal vive dentro de `useEffect(() => { ... }, [running])`:

  ```ts
  function loop(ts: number) {
    const dt = g!.lastTime === null ? 0 : Math.min((ts - g!.lastTime) / 1000, 0.05);
    g!.lastTime = ts;
    update(dt);
    draw();
    reportStats();
    if (g!.state === "gameover" && !g!.gameOverNotified) {
      g!.gameOverNotified = true;
      onGameOverRef.current(g!.score);
    }
    raf = requestAnimationFrame(loop);
  }
  ```

  `dt` en segundos, clampado a `0.05`. `g.lastTime = null` se resetea justo antes de arrancar el `requestAnimationFrame`, para que pausar/reanudar no produzca un salto de `dt` gigante.

- Cleanup del efecto: `cancelAnimationFrame(raf)` + remover ambos listeners de teclado.
- Render: un único `<canvas>`, resolución interna fija, escalado por CSS:

  ```tsx
  <canvas
    ref={canvasRef}
    width={W}
    height={H}
    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
  />
  ```

## 3. Transformación mecánica: vanilla canvas → componente React

Cuando la fuente es un `game.js` de `references/started-games/`, el porte sigue siempre esta lista, en este orden:

1. `'use strict'` + globals de módulo → `"use client"` + `import { useEffect, useRef } from "react"`.
2. `const ctx = canvas.getContext('2d')` global → parámetro `ctx` en cada `draw`.
3. `let ship, bullets, asteroids, ...` sueltos a nivel de módulo → un único `type GameState` construido por una función `createInitialState()`, guardado en el `useRef`.
4. Se elimina cualquier función de dibujo de HUD/overlay propio del original (en el caso de Asteroids: `drawHUD`, `drawOverlay`) y cualquier reinicio por teclado en el estado de game over (`if (pressed('Space')) initGame()`).
5. Se añade el flag `gameOverNotified` que el original no tiene.
6. `pressed(code)` y el resto de utilidades de input se mantienen igual, pero leyendo `g!.keys`/`g!.justPressed` del ref en vez de globals de módulo.

Si hay un `README.md` junto al `game.js` que describe features no presentes en el código (power-ups, tipos especiales, etc.), el spec se basa en el código — la discrepancia se documenta como _Out of scope_, no se implementa.

## 4. `lib/game-registry.ts` — el punto de conexión con `PlayerScreen`

Hoy `PlayerScreen.tsx:11` resuelve el juego real con `const isAsteroids = game.id === "asteroides"`. Esto no escala a un segundo juego. La primera vez que un spec generado por este skill añade un juego real, debe crear este archivo:

```ts
"use client";

import type { ComponentType } from "react";
import { AsteroidsGame } from "@/components/AsteroidsGame";

export type GameStats = { score: number; lives: number; level: number };

export type PlayableGameProps = {
  running: boolean;
  onStats: (stats: GameStats) => void;
  onGameOver: (finalScore: number) => void;
};

const PLAYABLE_GAMES: Record<string, ComponentType<PlayableGameProps>> = {
  asteroides: AsteroidsGame,
};

export function getPlayableGame(id: string): ComponentType<PlayableGameProps> | null {
  return PLAYABLE_GAMES[id] ?? null;
}
```

**Por qué imports estáticos y no `next/dynamic`:** cada juego son unas ~500 líneas sin assets externos que justifiquen un split de bundle, y evita depender de una API de carga diferida de Next 16 que `CLAUDE.md` obliga a verificar contra `node_modules/next/dist/docs/` antes de usarla. El spec debe anotar esto en `## Decisions` como una entrada **No:** con este motivo.

Si `lib/game-registry.ts` **ya existe** (compruébalo con el session context del skill), el plan de implementación no lo vuelve a crear — solo añade una entrada al mapa `PLAYABLE_GAMES` y un `import` nuevo.

### El refactor de `PlayerScreen.tsx` (solo la primera vez)

Reemplazos exactos sobre el archivo actual:

- `const isAsteroids = game.id === "asteroides";` → `const Playable = getPlayableGame(game.id);`
- `const [asteroidsLevel, setAsteroidsLevel] = useState(1);` → `const [gameLevel, setGameLevel] = useState(1);`
- `const level = isAsteroids ? asteroidsLevel : Math.floor(score / 2500) + 1;` → `const level = Playable ? gameLevel : Math.floor(score / 2500) + 1;`
- El `useEffect` del ticker falso (línea ~29) cambia su condición de guarda de `if (isAsteroids || over || paused) return;` a `if (Playable || over || paused) return;`, y su array de dependencias de `[isAsteroids, over, paused]` a `[Playable, over, paused]`.
- El bloque de render (línea ~102) cambia de:

  ```tsx
  {
    isAsteroids ? (
      <AsteroidsGame
        key={playId}
        running={!paused && !over}
        onStats={handleStats}
        onGameOver={endGame}
      />
    ) : (
      <div className="game-arena">...</div>
    );
  }
  ```

  a:

  ```tsx
  {
    Playable ? (
      <Playable
        key={playId}
        running={!paused && !over}
        onStats={handleStats}
        onGameOver={endGame}
      />
    ) : (
      <div className="game-arena">...</div>
    );
  }
  ```

- `handleStats` pasa a usar `setGameLevel` en vez de `setAsteroidsLevel`.
- `AsteroidsGame.tsx` ya no declara un tipo de props local: importa `PlayableGameProps` directamente de `lib/game-registry.ts`, igual que `TetrisGame.tsx`. Un juego nuevo debe hacer lo mismo desde el principio — no dupliques la forma del contrato.

## 5. Plantilla de migración para el catálogo

Forma tomada de `supabase/migrations/0002_seed_games.sql`. Un juego nuevo (id no sembrado todavía) necesita un archivo `supabase/migrations/000N_add_game_<id>.sql`:

```sql
insert into games (id, title, short, long, cat, cover, color, sort_order) values
  ('<id>', '<TÍTULO>', '<frase corta>', '<descripción larga>',
   '<ARCADE|PUZZLE|SHOOTER|VERSUS>', 'cover-<slug>', '<cyan|magenta|yellow|green>', <sort_order>);
```

Restricciones que el spec debe respetar en sus criterios de aceptación (vienen de `0001_games_scores.sql`):

- `cat` solo acepta `'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS'`.
- `color` solo acepta `'cyan' | 'magenta' | 'yellow' | 'green'`.
- `player_name` de una puntuación: 1 a 10 caracteres.
- `score`: entre 0 y 10 000 000.
- `id` es simultáneamente la PK de `games` y el segmento de URL de `/juegos/[id]` y `/jugar/[id]` — cambiarlo después rompe enlaces existentes (riesgo aceptado ya en SPEC 04/05, sin redirects).

La migración se aplica también con la herramienta MCP `apply_migration` contra el proyecto `grgkpgfilsyoxkniyzce` — nunca solo vía MCP sin el archivo commiteado en `supabase/migrations/`.

Si el `id` ya está en `supabase/migrations/0002_seed_games.sql` (juego mock existente que se está conectando a un juego real por primera vez), **no hace falta migración**: la fila de `games` ya existe y no cambia.

## 6. Checklist de los 7 puntos de integración

Esta es la columna vertebral del `## Implementation plan` que el skill genera. Cada punto es un paso independiente y commiteable; se omiten los marcados como condicionales cuando no aplican.

1. **Migración** `supabase/migrations/000N_add_game_<id>.sql` con el `INSERT` en `games`, aplicada también por `apply_migration` (MCP). _— se omite si el `id` ya está sembrado._
2. **Clase CSS de portada** `.cover-<slug>` en `app/globals.css` (patrón junto a las demás `.cover-*`, alrededor de las líneas 397-510). _— se omite si el juego reutiliza una portada existente._
3. **Regenerar `database.types.ts`** con la herramienta MCP `generate_typescript_types`. _— solo si la migración cambió el esquema; un `insert` sobre una tabla existente no lo requiere._
4. **`components/<Nombre>Game.tsx`** (`"use client"`) — normalmente dos pasos de plan: (a) clases de entidades + loop dibujando en el canvas sin controles ni contrato todavía; (b) props `running`/`onStats`/`onGameOver` conectadas al loop y a los listeners de teclado.
5. **`lib/game-registry.ts`** — crearlo junto con el refactor de `PlayerScreen` (primera vez), o añadir una entrada al mapa `PLAYABLE_GAMES` (siguientes veces).
6. **Leaderboard: cero cambios de código.** Paso de verificación manual únicamente: jugar una partida, guardar la puntuación, confirmar que aparece en `/juegos/<id>` y en `/salon`, y que el estado vacío muestra literalmente `"AÚN NO HAY PUNTUACIONES"` antes de la primera partida.
7. **Pasada final:** `npm run lint` && `npm run build` sin errores, más recorrido manual completo — jugar, perder/terminar, guardar puntuación con iniciales, "JUGAR DE NUEVO", pausar/reanudar a medio juego, botón FIN, escribir en el input de iniciales con las flechas del teclado sin que el juego las capture, y confirmar que otro juego con mock (`.game-arena`) no tiene regresiones.

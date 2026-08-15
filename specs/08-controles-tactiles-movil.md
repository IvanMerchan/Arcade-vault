# SPEC 08 — Controles táctiles para jugar en móvil

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 07
> **Date:** 2026-08-15
> **Objective:** Permitir jugar Asteroides y Caída desde un móvil táctil, con una botonera en pantalla y un layout vertical sin scroll, sin tocar el resto del sitio.

---

## Por qué este spec

Hoy no hay ni una línea de código táctil en el repo: `AsteroidsGame` y `TetrisGame` sólo escuchan `window.addEventListener("keydown"/"keyup")`, y ninguno de los 12 `@media` de `app/globals.css` toca `.av-player`, `.crt`, `.crt-screen` o `.player-hud`. En un móvil de 390px el canvas de 800×600 queda escalado a ~294×220px, con los bloques de Tetris a ~11px. `app/layout.tsx` tampoco exporta `viewport`. SPEC 07 dejó "controles táctiles/móviles" explícitamente fuera de alcance (líneas 51 y 166), así que este spec parte de terreno limpio.

---

## Scope

**In:**

- Ruta `/jugar/[id]` para los 2 juegos reales: `asteroides` y `caida`.
- Botonera táctil en pantalla (D-pad + acciones), visible sólo con `@media (pointer: coarse)`.
- Layout vertical (`100dvh`) sin scroll: HUD compacto, canvas escalado al ancho, botonera abajo.
- Viewport meta correcto (`app/layout.tsx`).
- Bloqueo de gestos del navegador (zoom, pull-to-refresh, selección de texto) sólo dentro de la zona de juego.
- Mapa de teclas + auto-repeat (DAS) en Caída, hoy inexistente.
- Ajustes menores de accesibilidad móvil en el input de iniciales del modal de game over.

**Out of scope (for future specs):**

- Responsive del resto del sitio (`/`, `/biblioteca`, `/juegos/[id]`, `/salon`, `/auth`).
- Controles táctiles para los 6 juegos del mock arena (`bloque-buster`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) — no tienen componente real de dibujo.
- Modo horizontal con layout dedicado (botones a los lados).
- Fullscreen API.
- Gestos sobre el canvas (swipe/tap) como método de control.
- Vibración háptica (`navigator.vibrate`).
- Soporte de gamepad físico.

---

## Data model

En `lib/game-registry.ts`, extensión del contrato existente:

```ts
export type TouchInputHandle = {
  press: (code: string) => void; // code = KeyboardEvent.code que el juego ya entiende
  release: (code: string) => void;
};

export type PlayableGameProps = {
  running: boolean;
  onStats: (stats: GameStats) => void;
  onGameOver: (finalScore: number) => void;
  skin: GameSkin;
  touchInput: RefObject<TouchInputHandle | null>; // el juego escribe aquí su handle
};
```

Los `code` son los mismos strings que ya usan ambos juegos (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Space`), así que teclado y táctil convergen en la misma ruta de código dentro de cada juego.

Nuevo archivo `lib/touch-controls.ts`:

```ts
export type TouchButton = {
  code: string; // "ArrowLeft"
  glyph: string; // "◀"
  aria: string; // "Girar a la izquierda"
  side: "left" | "right"; // cluster del pulgar
};

export const TOUCH_LAYOUTS: Record<string, TouchButton[]>; // claves: "asteroides", "caida"
export function getTouchLayout(gameId: string): TouchButton[] | null;
```

`TetrisState` (`components/TetrisGame.tsx`) recibe lo que SPEC 07 declaró pero nunca implementó:

```ts
keys: Record<string, boolean>;
dasTimer: Record<string, number>; // ms acumulados por code mantenido
```

Constantes `DAS_DELAY = 170` y `DAS_INTERVAL = 50` (ms; el loop de Caída ya trabaja en milisegundos).

---

## Implementation plan

1. **Viewport.** Añadir `export const viewport: Viewport` en `app/layout.tsx` con `width: "device-width"`, `initialScale: 1`, `viewportFit: "cover"`. Sin `userScalable: false`. Verificación manual: DevTools muestra el meta viewport con `viewport-fit=cover`.

2. **Contrato.** Añadir `TouchInputHandle` y el prop `touchInput` a `PlayableGameProps` en `lib/game-registry.ts`; crear `lib/touch-controls.ts` con los layouts de ambos juegos. `PlayerScreen` crea el ref con `useRef<TouchInputHandle | null>(null)` y lo pasa a ambos componentes de juego. Verificación manual: `npm run build` pasa, nada cambia visualmente todavía.

3. **Asteroides recibe táctil.** En `components/AsteroidsGame.tsx`, extraer los cuerpos de `onKeyDown`/`onKeyUp` a funciones `press(code)`/`release(code)` reutilizadas por ambos listeners, e instalar `touchInput.current = { press, release }` dentro del mismo `useEffect([running])`, limpiándolo (`touchInput.current = null`) en el cleanup. Verificación manual: desde la consola del navegador, `touchInput.current.press("ArrowLeft")` gira la nave.

4. **Componente de botonera.** Crear `components/TouchControls.tsx` (`"use client"`): recibe `{ buttons, skin, onPress, onRelease }`, usa `onPointerDown`/`onPointerUp`/`onPointerCancel` con `setPointerCapture` para que soltar el dedo fuera del botón siga liberando la acción, colores tomados de `skin.primary`/`skin.accent`, botones de mínimo 56px de lado. Verificación manual: en el emulador de móvil de DevTools los botones aparecen bajo el canvas y responden al estado `:active`.

5. **Cableado en PlayerScreen.** Renderizar `<TouchControls>` bajo `.crt`, sólo cuando `isPlayable(game.id)`. Al pasar `paused` u `over` a `true`, soltar todos los `code` retenidos (llamar `release` para cada uno) para que ninguna acción quede pegada al reanudar. Verificación manual: pulsar ◀, pausar, reanudar → la nave queda quieta.

6. **CSS móvil.** En `app/globals.css`: `.touch-controls` oculto por defecto y visible bajo `@media (pointer: coarse)`; `touch-action: none` y `user-select: none` en `.crt-screen` y en `.touch-controls`; bajo `@media (pointer: coarse) and (max-width: 860px)` el layout pasa a `100dvh` (HUD compacto arriba, canvas al medio, botonera abajo con `padding-bottom: env(safe-area-inset-bottom)`), y `.btn`/`.skin-switch button` suben a mínimo 44px de alto. Verificación manual: en un viewport de 390×844 con puntero coarse simulado, todo cabe sin scroll y el canvas ocupa el ancho disponible.

7. **Bloqueo de scroll durante la partida.** `PlayerScreen` añade la clase `is-playing` a `<body>` al montar y la quita al desmontar (`useEffect` con cleanup). Bajo `@media (pointer: coarse)`, `body.is-playing` recibe `overflow: hidden` y `overscroll-behavior: none`, y oculta el footer del sitio. Verificación manual: arrastrar el dedo sobre el canvas en móvil no dispara pull-to-refresh.

8. **Caída: mapa de teclas + DAS.** Añadir `keys` y `dasTimer` a `TetrisState`; refactorizar `onKeyDown` en funciones `press(code)`/`release(code)`; el listener de teclado ignora `event.repeat` para que toda la repetición la conduzca el DAS; procesar la repetición de `ArrowLeft`/`ArrowRight`/`ArrowDown` dentro de `update(dt)` usando `DAS_DELAY`/`DAS_INTERVAL`. Rotar (`ArrowUp`/`KeyX`) y caída rápida (`Space`) siguen siendo discretos, sin DAS. Verificación manual: mantener ◀ con el teclado mueve la pieza repetidamente tras ~170ms, igual que antes del refactor pero ahora de forma explícita.

9. **Caída recibe táctil.** Instalar `touchInput.current = { press, release }` reusando las funciones del paso 8, dentro del `useEffect([running])` existente. Verificación manual: los 5 botones táctiles mueven, bajan, rotan y hacen caída rápida de la pieza.

10. **Pulido del input de iniciales.** En el modal de game over de `PlayerScreen`, añadir al `<input>` los atributos `inputMode="text"`, `autoCapitalize="characters"`, `autoCorrect="off"`, `spellCheck={false}`. Verificación manual: en un móvil real, el teclado abre en modo texto, sin autocorrector ni sugerencias.

---

## Acceptance criteria

- [x] En un viewport de 390×844 con puntero coarse, `/jugar/asteroides` cabe entero sin scroll vertical.
- [x] Los 4 botones de Asteroides (◀ ▶ ▲ ●) giran, propulsan y disparan la nave.
- [x] Los 5 botones de Caída (◀ ▶ ▼ ⟳ ⬇) mueven, bajan, rotan y hacen caída rápida de la pieza.
- [x] Mantener pulsado ◀ o ▶ en Caída mueve la pieza repetidamente tras ~170ms de delay inicial.
- [x] Deslizar el dedo fuera de un botón sin soltarlo libera la acción correctamente (no queda pegada).
- [x] Pausar el juego con una acción retenida y luego reanudar deja el juego quieto, sin inercia fantasma.
- [x] Doble toque sobre el canvas no produce zoom, y arrastrar sobre él no dispara pull-to-refresh.
- [x] La botonera cambia de color al cambiar de skin (clasico/neon/retro) desde el selector existente.
- [x] En un dispositivo con puntero fine (mouse), la botonera no se renderiza visible y la pantalla de juego no cambia respecto a su comportamiento actual.
- [x] El teclado sigue controlando ambos juegos exactamente igual que antes de este spec.
- [x] Ningún botón interactivo de `/jugar` (HUD, skin-switch, botonera) mide menos de 44px de alto en viewport móvil.
- [x] `npm run lint` y `npm run build` pasan sin errores.

---

## Decisions

- **Sí:** botonera en pantalla en vez de gestos sobre el canvas. Es precisa, descubrible y encaja con la estética arcade retro del proyecto.
- **No:** gestos (swipe/tap) como método de control. Menos código pero impreciso y nada descubrible para un usuario nuevo.
- **Sí:** sólo vertical, canvas escalado al ancho con botonera debajo. Es como el usuario agarra el móvil por defecto; exigir horizontal añade fricción.
- **No:** forzar landscape con un overlay de "gira el dispositivo". Bloquea jugar de inmediato.
- **Sí:** detección vía CSS `@media (pointer: coarse)`, siguiendo el patrón ya usado por el hamburger de `Nav.tsx` (`@media (max-width: 840px)`). Consistente con el resto del repo y no requiere JS de detección de dispositivo.
- **No:** sniffing de dispositivo en JS (`navigator.maxTouchPoints`, user-agent). Menos robusto que la media query nativa del navegador.
- **Sí:** `touchInput` como ref mutable en `PlayableGameProps`. Explícito, tipado, sin efectos globales; el juego lo lee igual que ya lee `skin`.
- **No:** sintetizar `KeyboardEvent` con `window.dispatchEvent`. Funciona sin tocar los juegos, pero es input fantasma (`isTrusted: false`) que puede sorprender a futuro.
- **No:** que cada juego dibuje su propia botonera. Rompe la regla ya establecida del repo de que el componente de juego no dibuja su propia UI — eso es responsabilidad de `PlayerScreen`.
- **Sí:** DAS (auto-repeat) en Caída al mantener pulsado. Es el estándar de cualquier Tetris; sin esto, mover 5 celdas exige 5 toques. Requiere añadir el mapa de teclas que SPEC 07 había declarado pero nunca implementó.
- **Sí:** `touch-action: none` y `user-select: none` sólo en la zona de juego y la botonera, no en todo el sitio. Resuelve el problema de gestos sin sacrificar el zoom accesible del resto de páginas.
- **No:** `viewport` con `userScalable: false` a nivel de sitio. Mala práctica de accesibilidad — impediría hacer zoom en cualquier página.
- **Sí:** la botonera se tiñe con `skin.primary`/`skin.accent` de `lib/game-skins.ts`. Coherencia visual con el canvas; el objeto de skin ya existe y viaja como prop.
- **Sí:** feedback sólo visual (`:active` + `-webkit-tap-highlight-color: transparent`).
- **No:** `navigator.vibrate`. iOS Safari no lo soporta y añadiría una rama de fallback para un beneficio menor.
- **Sí:** HUD compacto pero sin perder funciones — stats en una fila, skin-switch/PAUSA/FIN/SALIR en una segunda fila.
- **No:** esconder el selector de skin en móvil, ni meter esas acciones detrás de un menú "⋮". Ambas opciones quitan o esconden funcionalidad existente sin necesidad.

---

## Risks

| Riesgo                                                                                              | Mitigación                                                                                                                    |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `100dvh` inestable por la barra de URL dinámica de Safari iOS                                       | `dvh` ya contempla la barra dinámica; el canvas usa `max-height` para que un desajuste recorte margen, nunca el área jugable. |
| El dedo sale del botón mientras está pulsado y la acción se queda activa                            | `setPointerCapture` en `pointerdown` garantiza que el `pointerup` llegue al mismo botón; `pointercancel` libera igualmente.   |
| Doble repetición en Caída (auto-repeat nativo del navegador + DAS propio)                           | El listener de teclado ignora `event.repeat`; toda la repetición pasa a estar conducida únicamente por el DAS.                |
| `(pointer: coarse)` no detecta correctamente portátiles híbridos (2-en-1)                           | Degrada mostrando la botonera igualmente; el teclado sigue funcionando en paralelo sin conflicto.                             |
| Refactorizar `TetrisState` para añadir `keys`/`dasTimer` rompe el juego ya implementado con teclado | El paso 8 es un refactor puro, verificado manualmente con teclado antes de conectar nada táctil en el paso 9.                 |

---

## What is **not** in this spec

- Responsive del resto del sitio (`/`, `/biblioteca`, `/juegos/[id]`, `/salon`, `/auth`).
- Controles táctiles para los 6 juegos del mock arena.
- Modo horizontal con layout dedicado.
- Fullscreen API.
- Gestos sobre el canvas como método de control.
- Vibración háptica.
- Soporte de gamepad físico.

Cada uno de estos, si se implementa, va en su propio spec.

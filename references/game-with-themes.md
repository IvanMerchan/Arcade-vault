# Juegos con skin — estado vigente

Mantenido por el agente `skin-designer` (`.claude/agents/skin-designer.md`). Es la referencia rápida de qué juegos jugables ya tienen las 3 skins (`clasico`/`neon`/`retro`) implementadas — trátalo como snapshot, verificar contra el código real (`lib/game-skins.ts`, `components/*Game.tsx`) antes de confiar en él a ciegas, igual que `references/implemented-games.md` para el catálogo.

**El agente trabaja un juego a la vez.** Si hay más de un juego `Parcial`/`Ausente`, solo se implementa el que el usuario indique explícitamente en cada pasada — nunca todos de una vez.

Estados: `Completa` (recibe `skin: GameSkin` y ningún color vive fuera de ella) · `Parcial` (recibe la prop pero le quedan literales sin usar) · `Ausente` (ni siquiera acepta la prop).

---

## Ronda 1 — 2026-08-14

### Estado por juego

| Juego (`id`) | Componente | Estado | Skins | Notas |
| --- | --- | --- | --- | --- |
| `asteroides` | `components/AsteroidsGame.tsx` | `Completa` | `clasico`, `neon`, `retro` | Tipo de props unificado con `PlayableGameProps` (ya no duplicaba `AsteroidsGameProps` local). Glow con `withGlow()`; retro usa `lineWidth: 2` sin glow como diferenciación de técnica. |
| `caida` | `components/TetrisGame.tsx` | `Completa` | `clasico`, `neon`, `retro` | El array `COLORS` fijo (skin Neon del SPEC 07, sin selector) se reemplazó por `skin.pieces`; rejilla, HUD lateral (`LÍNEAS`/`COMBO`/`SIGUIENTE`) y fondo también tematizados. |

Los 6 juegos con mock del catálogo (`bloque-buster`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) quedan **fuera de alcance** — no tienen componente de dibujo real que tematizar todavía.

Único literal de color fuera de `lib/game-skins.ts` en `components/*Game.tsx`: `rgba(255, 255, 255, 0.18)` en `TetrisGame.tsx` (banda de highlight de la skin `retro`). Es una constante de técnica de render (el bisel blanco), no un color de skin — excepción documentada, no pendiente.

### Auditoría de contraste (WCAG, ratio vs `--bg: #0a0a0f` de cada skin)

Umbrales: gráficos (trazos/piezas) ≥ 3.0:1 · texto dibujado en canvas ≥ 4.5:1 · `bg` de la skin debe leerse "casi negro" frente a `--bg`.

| Skin | `bg` | `ink`/`primary` | `accent` | `pieces` (mín–máx) | Veredicto |
| --- | --- | --- | --- | --- | --- |
| `clasico` | `#0a0a0f` (= `--bg`, idéntico) | `#e6e9ff` — alto contraste | `#ffcf3a` (`--gold`) — alto contraste | `#00f5ff`…`#ff8c00`, todos ≥ 5:1 | PASA |
| `neon` | `#000000` — casi negro | `#00f5ff` (`--cyan`) — alto contraste | `#ff006e` (`--magenta`) — ≈5.2:1 | `#00f5ff`…`#ff8000`, todos ≥ 5:1 | PASA |
| `retro` | `#0f0a05` — casi negro | `#ffcf3a` (`--gold`) — alto contraste | `#d97a3a` (`--bronze`) — ≈6.4:1 | `#4dd0e1`…`#ff7043`, todos ≥ 3:1 | PASA |

Todos los `bg` leen como parte del tubo CRT, no como un panel iluminado — ninguno se acerca al caso rechazado de referencia (`#f8f0ff` pastel del starter original, muy por encima del umbral).

### Pendientes

Ninguno. Ambos juegos jugables (`asteroides`, `caida`) tienen las 3 skins completas y verificadas. Cuando exista un tercer juego jugable (p. ej. `ranaria`, ver `specs/game-jam/ranaria/`), aparecerá aquí como `Ausente` hasta que el usuario pida explícitamente trabajarlo.

---

## Ronda 2 — 2026-08-14 (verificación, sin cambios de código)

Re-auditoría independiente (no se confió en la Ronda 1 solo porque existiera). Confirmado contra código real:

- `lib/game-registry.ts`: `isPlayable()` sigue cubriendo solo `{"asteroides", "caida"}`. `Glob("components/*Game.tsx")` sigue devolviendo únicamente `AsteroidsGame.tsx` y `TetrisGame.tsx` — no hay tercer juego jugable que auditar.
- `lib/game-skins.ts` existe con la forma esperada (`SkinId`, `GameSkin`, `SKINS`, `SKIN_ORDER`, `DEFAULT_SKIN`, `getSkin`, `hexToRgb`).
- `AsteroidsGame.tsx` y `TetrisGame.tsx`: ambos importan `PlayableGameProps` de `lib/game-registry.ts` (sin tipo local duplicado), reciben `skin`, lo reflejan en `skinRef` (`useEffect` sobre `[skin]`), el loop de `requestAnimationFrame` lee `skinRef.current`, y ambos tienen el efecto de repintado en pausa `useEffect(() => { if (running) return; ... }, [skin, running])`. El efecto principal del loop depende solo de `[running]` en los dos componentes.
- `Grep("#[0-9a-fA-F]{3,8}\\b|rgba?\\(", glob="components/*Game.tsx")` da 4 aciertos, los mismos de la Ronda 1: 3 son `rgba()` derivados de `hexToRgb(skin.xxx)` (legítimos) y 1 es la banda de highlight `rgba(255, 255, 255, 0.18)` en `TetrisGame.tsx` (constante de técnica de render de la skin `retro`, documentada, no un color de skin suelto). Cero literales sin justificar.
- `components/PlayerScreen.tsx`: `key={playId}` no incluye la skin; `skin={skin}` se pasa como prop aparte; el `useState<SkinId>` y el `localStorage` de persistencia viven en `PlayerScreen`, no dentro de los componentes de juego.
- Auditoría de contraste recalculada de forma independiente con `node -e` (fórmula WCAG de luminancia relativa + ratio `(L1+0.05)/(L2+0.05)`), no copiada de la Ronda 1:

| Skin | `bg` lum. relativa | ratio `bg` vs `--bg` app (`#0a0a0f`) | `ink`/`primary` | `accent` | `pieces` (mín–máx) |
| --- | --- | --- | --- | --- | --- |
| `clasico` | 0.0032 | 1.00 (idéntico) | 16.43:1 | 13.39:1 | 5.15:1 – 18.05:1 |
| `neon` | 0.0000 | 1.06 (casi negro) | 15.50:1 | 5.48:1 | 5.33:1 – 19.19:1 |
| `retro` | 0.0033 | 1.00 (idéntico) | 13.36:1 | 6.38:1 | 5.54:1 – 13.96:1 |

Todos los roles superan tanto el umbral de gráficos (3.0:1) como el de texto (4.5:1) — incluido `ink` usado como texto de HUD en CAÍDA (`LÍNEAS`/`COMBO`/`SIGUIENTE`), que exige 4.5:1. Los `bg` de las 3 skins tienen luminancia relativa prácticamente igual a `--bg` (≈0.003), muy lejos del caso rechazado de referencia (`#f8f0ff` pastel). PASA en todos los roles y las 3 skins.

**Resultado de esta pasada:** sistema al día, no se implementó ningún juego (no había candidato `Parcial`/`Ausente`). No se tocó código de aplicación.

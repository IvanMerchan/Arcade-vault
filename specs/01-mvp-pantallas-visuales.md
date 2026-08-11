# SPEC 01 — MVP visual: pantallas de Arcade Vault

> **Status:** Aprobado
> **Depends on:** —
> **Date:** 2026-08-11
> **Objective:** Portar las 5 pantallas de `references/templates/` a rutas reales del App Router de Next.js 16, reusando el tema ya presente en `app/globals.css`, sin ninguna lógica de juego jugable.

---

## Scope

**In:**

- Las 5 pantallas de la plantilla: biblioteca, detalle de juego, reproductor (HUD simulado), autenticación, salón de la fama.
- El nav superior con panel móvil (hamburguesa) y el footer, compartidos en `app/layout.tsx`.
- El fondo decorativo (`.av-bg`, `.av-noise`) aplicado a nivel de layout.
- Sesión de usuario mock persistida en `localStorage` (`av_user`, `av_scores`), sin backend.
- Pantalla 404 con estética arcade para ids de juego inexistentes.
- Datos de los 8 juegos y el generador de puntuaciones (`seededScores`), portados desde `references/templates/data.jsx`.

**Out of scope (for future specs):**

- Cualquier juego jugable real (canvas, loop de física, input de teclado/táctil). El reproductor solo simula el HUD.
- Autenticación real, OAuth de los botones "GOOGLE"/"GITHUB" (quedan inertes, `type="button"` sin `onClick` funcional).
- Backend, base de datos o API de puntuaciones.
- Contador de créditos funcional (se muestra fijo en `03`, igual que la plantilla).
- Tests automatizados (no hay test runner configurado en `package.json`).
- Metadata por pantalla, mejoras de accesibilidad más allá de las obligadas por el cambio de routing, y `loading.tsx` — el usuario pidió portar la plantilla tal cual, sin pulido adicional.

---

## Data model

```ts
// lib/games.ts
type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;   // clase CSS de portada, p.ej. "cover-bricks"
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;   // p.ej. "12.4K"
};

type ScoreRow = { rank: number; name: string; score: number; date: string };
```

- `GAMES: Game[]` — los 8 juegos de `references/templates/data.jsx`, copiados sin cambios.
- `CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]`.
- `seededScores(seed: number, count = 12): ScoreRow[]` — generador determinista portado tal cual; al ser determinista puede ejecutarse tanto en servidor como en cliente sin desajuste de hidratación.
- `getGame(id: string): Game | undefined` — helper de búsqueda usado por las rutas dinámicas.

Sesión mock, solo en cliente, vía `SessionProvider` + `localStorage`:

- `av_user` → `{ name: string } | null`.
- `av_scores` → `Array<{ game: string; score: number; name: string; at: number }>`.

---

## Implementation plan

1. Crear `lib/games.ts` con los tipos, `GAMES`, `CATS`, `seededScores` y `getGame`, copiando los datos de `references/templates/data.jsx`.
2. Crear `components/SessionProvider.tsx` (`"use client"`, contexto con `user`, `signIn`, `signOut`, `saveScore`, lectura/escritura de `localStorage` dentro de `useEffect`) y `components/Nav.tsx` (`"use client"`, usa `usePathname()` para el estado activo y `<Link>` en vez de `onClick` sin `href`). Reescribir `app/layout.tsx` para envolver `children` con `SessionProvider`, renderizar `.av-bg`/`.av-noise`, `<Nav>`, `<main className="av-main">` y el footer del pie de página. `app/page.tsx` queda como placeholder temporal.
3. Crear `components/GameCard.tsx` (`"use client"`, efecto tilt con `onMouseMove`/`onMouseLeave`) y `components/LibraryScreen.tsx` (`"use client"`, búsqueda por texto + chips de categoría). Implementar `app/page.tsx` como server component que pasa `GAMES` a `LibraryScreen`.
4. Crear `app/juegos/[id]/page.tsx` como server component: `generateStaticParams()` sobre `GAMES`, `notFound()` si `getGame(id)` no existe, render de portada/tags/stats/`seededScores`. Crear `app/not-found.tsx` con estética arcade ("CARTUCHO NO ENCONTRADO" + botón volver a `/`).
5. Crear `components/PlayerScreen.tsx` (`"use client"`, HUD con score/vidas/nivel, ticker vía `setInterval` en `useEffect`, pausa, botón FIN, modal de fin de partida con guardado vía `saveScore`) y `app/jugar/[id]/page.tsx` que resuelve el juego server-side y pasa el `Game` a `PlayerScreen`, con `notFound()` si no existe.
6. Crear `components/AuthScreen.tsx` (`"use client"`, pestañas iniciar/crear cuenta, campo de invitado, botones sociales inertes, llama a `signIn` del contexto y navega a `/` con `useRouter`) y `app/auth/page.tsx`.
7. Crear `components/HallOfFame.tsx` (`"use client"`, pestañas por juego, podio top-3, tabla de puntuaciones, fila "TU MEJOR MARCA" cuando hay sesión) y `app/salon/page.tsx`.
8. Pasada final: `npm run lint` y `npm run build` sin errores; recorrer las 5 rutas más una url de juego inválida verificando que la consola del navegador no muestra errores de hidratación.

---

## Acceptance criteria

- [ ] `/`, `/juegos/bloque-buster`, `/jugar/bloque-buster`, `/auth` y `/salon` renderizan sin errores en consola.
- [ ] `/juegos/id-inexistente` y `/jugar/id-inexistente` muestran la pantalla 404 con estética arcade.
- [ ] En `/`, escribir en el buscador filtra la grilla de juegos por título; seleccionar una categoría filtra por `cat`; si no hay resultados se muestra "NO HAY RESULTADOS".
- [ ] `/juegos/[id]` muestra portada, tags, sinopsis larga, stats (partidas/mejor global/dificultad) y una tabla de 10 puntuaciones.
- [ ] En `/jugar/[id]`, la puntuación aumenta sola cada ~220ms; "PAUSA" detiene el incremento y "REANUDAR" lo retoma; "FIN" abre el modal de fin de partida.
- [ ] Guardar la puntuación en el modal la persiste en `localStorage` (`av_scores`) y muestra el mensaje "PUNTUACIÓN GUARDADA".
- [ ] En `/auth`, alternar entre "INICIAR SESIÓN" y "CREAR CUENTA" cambia los campos visibles; enviar el formulario o pulsar "JUGAR COMO INVITADO" navega a `/` y el nombre de usuario aparece en el nav.
- [ ] "Cerrar sesión" desde el nav limpia `av_user` de `localStorage` y el nav vuelve a mostrar "Iniciar Sesión".
- [ ] En `/salon`, cambiar de pestaña de juego actualiza podio y tabla; con sesión iniciada aparece la fila "TU MEJOR MARCA EN [JUEGO]".
- [ ] El panel móvil del nav (hamburguesa) abre y cierra correctamente en viewport angosto.
- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] Ninguna pantalla contiene lógica de juego jugable (sin canvas, sin loop de físicas, sin manejo de input de juego).

---

## Decisions

- **Sí:** rutas reales del App Router (`/juegos/[id]`, `/jugar/[id]`, `/auth`, `/salon`) en vez de una SPA con `location.hash` como en la plantilla original. Aprovecha prerender estático, `<Link>` con prefetch y URLs compartibles — es la razón de usar Next.js.
- **No:** mantener el router por hash de `app.jsx`. Habría desperdiciado el App Router y complicado el SSR.
- **Sí:** el reproductor mantiene el HUD simulado completo (ticker de puntuación falso, pausa, modal de fin) tal como en la plantilla, para demostrar todos los estados visuales sin implementar un juego real.
- **Sí:** sesión mock con `localStorage`, replicando `av_user`/`av_scores` de `app.jsx`, para no perder el comportamiento de nav/salón que depende de sesión.
- **No:** Context en memoria sin persistencia. Se descartó porque la plantilla persiste explícitamente en `localStorage` y perderlo al recargar sería una regresión visible.
- **Sí:** reusar las clases existentes de `app/globals.css` (`.card`, `.crt`, `.podium`, etc.) en vez de reescribir en utilidades Tailwind. El CSS ya está portado y probado; reescribirlo arriesga romper animaciones y gradientes complejos sin ganar nada.
- **Sí:** página 404 con estética arcade (`notFound()` + `app/not-found.tsx`) para ids de juego inválidos. Es una pantalla que no existe en la plantilla SPA original pero se vuelve necesaria al introducir rutas reales.
- **No:** metadata por pantalla, mejoras de accesibilidad adicionales o `loading.tsx`. El usuario pidió portar la plantilla "solo lo visual", sin pulido fuera de su alcance.
- **Sí:** sustituir los `<a onClick>` sin `href` de la plantilla por `<Link href>` de Next.js. No es un extra opcional — es obligatorio para que la navegación funcione con rutas reales.

---

## Risks

| Risk | Mitigation |
|---|---|
| Desajuste de hidratación por leer `localStorage` o usar `Math.random()` durante el render | `SessionProvider` lee `localStorage` dentro de `useEffect`; el ticker de puntuación del reproductor genera números aleatorios solo dentro del `setInterval` en un efecto, nunca en el cuerpo del componente. |
| `params` es una `Promise` en Next.js 16, distinto a versiones anteriores conocidas por el modelo | Usar `await params` y los helpers globales `PageProps<'/juegos/[id]'>` / `PageProps<'/jugar/[id]'>`, como ya hace `app/layout.tsx` con `LayoutProps<"/">`. |
| El bloque `nextjs-agent-rules` de `AGENTS.md` se regenera automáticamente con `next dev` | Commitear el archivo junto con el resto de los cambios en vez de excluirlo del diff. |

---

## What is **not** in this spec

- Ningún juego jugable (los 8 "juegos" de `GAMES` siguen siendo solo tarjetas y un HUD simulado).
- Autenticación, base de datos o API de puntuaciones reales.
- Tests automatizados.
- Metadata SEO por pantalla, accesibilidad extendida o estados de carga (`loading.tsx`).

Cada uno de estos, si se implementa, va en su propio spec.

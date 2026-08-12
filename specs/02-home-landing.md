# SPEC 02 — Home landing real, Biblioteca se muda a /biblioteca

> **Status:** Implementado
> **Depends on:** SPEC 01
> **Date:** 2026-08-12
> **Objective:** Portar `references/templates/home-about/home.jsx` (sin `about.jsx`) como la pantalla real de `/`, moviendo la actual Biblioteca (hoy servida en `/`) a `/biblioteca`.

---

## Scope

**In:**

- Nuevo componente `Home` con las 7 secciones del template: hero (con eyebrow, título de 3 líneas, subtítulo, CTAs, silhouettes flotantes decorativas, indicador de scroll), "¿Por qué Arcade Vault?" (feature grid de 4 tarjetas), "Juegos disponibles ahora" (preview de 6 mini-cards + botón "ver todos"), stats (3 bloques), "Actividad en vivo" (ticker de últimas puntuaciones + top 5 jugadores de hoy), pricing (tarjeta de plan único + FAQ), CTA final.
- Animación de aparición al hacer scroll (`useReveal` + clases `.reveal`/`.in`) igual que el template.
- Mover la Biblioteca actual (`app/page.tsx` → `LibraryScreen`) a `app/biblioteca/page.tsx` y `app/biblioteca/loading.tsx`; `app/page.tsx` pasa a renderizar `Home`.
- Actualizar `components/Nav.tsx`: restaurar el link "Inicio" (desktop y panel móvil) apuntando a `/`, y cambiar los links/estado activo de "Biblioteca" para que apunten a `/biblioteca`.
- Portar a `app/globals.css` las clases CSS del template necesarias para estas secciones (home hero/silos, section head, feature grid, mini-rail/mini-card, home-stats, activity-grid/ticker/top-list, pricing-grid/price-card/faq, home-final, `.reveal`, `@keyframes float` y `@keyframes bounce`) que hoy no existen en el proyecto.
- Nuevo componente `MiniCard` (sin efecto tilt, más simple que `GameCard`) para el preview de juegos del home, reusando las clases `.cover-*` ya existentes.

**Out of scope (for future specs):**

- `about.jsx` y cualquier pantalla "Acerca de" — explícitamente excluida por el usuario.
- Cualquier dato real en "Actividad en vivo": se copian los arrays de ejemplo del template tal cual (nombres/puntajes inventados), sin derivarlos de `seededScores` ni de `localStorage`.
- Cambios al `GameCard` existente, a `LibraryScreen`, o a cualquier otra pantalla ya portada en SPEC 01.
- Contador de créditos funcional, autenticación real, backend — sigue igual que SPEC 01.
- Tests automatizados (no hay test runner configurado).

---

## Data model

No se introducen estructuras de datos nuevas. `Home` reutiliza `GAMES` de `lib/games.ts` (mismo array de 8 juegos ya portado en SPEC 01), tomando los primeros 6 (`GAMES.slice(0, 6)`) para el preview. Los datos de la sección "Actividad en vivo" (últimas puntuaciones, top 5 jugadores) son arrays literales dentro del componente, copiados del template, sin tipo compartido con `ScoreRow`.

---

## Implementation plan

1. Portar a `app/globals.css` las clases y keyframes listados en el scope, copiados de `references/templates/home-about/styles.css` (líneas ~931–1069 y ~1622–1725, más `@keyframes bounce`), verificando que no colisionan con clases existentes (ya confirmado: sin colisiones).
2. Crear `components/MiniCard.tsx` (server-friendly, sin `"use client"` si no usa hooks) reusando `game.cover`, `.cover-bg` y el resto de clases ya existentes.
3. Crear `components/Home.tsx` (`"use client"`, por el `useReveal`/`IntersectionObserver`): hero con `FloatingSilhouettes` (SVGs inline, igual que el template), sección de features con `FeatureIcon`, preview de juegos con `MiniCard` sobre `GAMES.slice(0, 6)`, stats, actividad en vivo con los arrays de ejemplo del template, pricing con FAQ, CTA final. Todos los `navigate(...)` del template se traducen a `<Link href="/biblioteca">` / `<Link href="/auth">` de Next.js.
4. Reescribir `app/page.tsx` para renderizar `<Home />`.
5. Crear `app/biblioteca/page.tsx` (idéntico al `app/page.tsx` actual: server component que pasa `GAMES` a `LibraryScreen`) y `app/biblioteca/loading.tsx` (idéntico a `app/loading.tsx` actual, reusando `LoadingScreen`).
6. Editar `components/Nav.tsx`: agregar `<Link href="/">Inicio</Link>` antes de "Biblioteca" en el nav de escritorio y en el panel móvil; cambiar `href="/"` de los links de "Biblioteca" a `href="/biblioteca"`; actualizar `isLibraryActive` para que compare contra `/biblioteca` (y siga cubriendo `/juegos` y `/jugar`) y agregar un `isHomeActive` para el nuevo link basado en `pathname === "/"`.
7. Pasada final: `npm run lint` y `npm run build` sin errores; recorrer `/`, `/biblioteca`, `/juegos/[id]`, `/salon` en el navegador verificando que no hay errores de hidratación ni de consola, que el scroll-reveal de las secciones del home funciona, y que el nav resalta el link correcto en cada ruta.

---

## Acceptance criteria

- [x] `/` renderiza el nuevo `Home` con sus 7 secciones (hero, features, preview de juegos, stats, actividad en vivo, pricing, CTA final).
- [x] `/biblioteca` renderiza el buscador + chips de categoría + grilla de juegos que hoy vive en `/`.
- [x] El nav muestra "Inicio", "Biblioteca" y "Salón de la Fama" en ese orden, tanto en escritorio como en el panel móvil.
- [x] El link "Inicio" está activo (clase `active`) en `/`; el link "Biblioteca" está activo en `/biblioteca`, `/juegos/[id]` y `/jugar/[id]`.
- [x] En el home, "EXPLORAR JUEGOS" e "INSERTAR MONEDA →" navegan a `/biblioteca`; "CREAR CUENTA" y "EMPEZAR GRATIS →" navegan a `/auth`.
- [x] Las 6 mini-cards de "JUEGOS DISPONIBLES AHORA" navegan a `/juegos/[id]` del juego correspondiente; "VER TODOS LOS JUEGOS →" navega a `/biblioteca`.
- [x] Al hacer scroll en el home, cada sección con clase `.reveal` hace fade-in + translate una sola vez al entrar en viewport (no se repite al volver a scrollear).
- [x] `npm run lint` y `npm run build` terminan sin errores.
- [x] No hay errores de hidratación en consola al navegar entre `/`, `/biblioteca`, `/juegos/[id]` y `/salon`.

---

## Decisions

- **Sí:** mover la Biblioteca a `/biblioteca` en vez de `/juegos`. Coincide con el nombre de la pantalla original de la plantilla SPA y con la etiqueta ya visible en el nav, evitando ambigüedad con `/juegos/[id]` (detalle).
- **Sí:** "Actividad en vivo" con datos estáticos copiados del template tal cual, sin derivarlos de `seededScores` ni sesión real. Consistente con el resto del MVP visual (SPEC 01): sin backend, sin agregación real de puntuaciones.
- **Sí:** portar las clases CSS del template tal cual a `app/globals.css`, en vez de reescribir con utilidades Tailwind o adaptarlas a tokens distintos. Mismo criterio que SPEC 01: el CSS ya está probado, reescribirlo arriesga romper animaciones/gradientes sin ganar nada.
- **Sí:** `MiniCard` como componente nuevo y más simple que `GameCard` (sin efecto tilt), igual que en el template. `GameCard` ya tiene su propio efecto pensado para la grilla completa de biblioteca; el preview del home es una fila compacta de 6 tarjetas.
- **No:** modificar `about.jsx` o crear pantalla "Acerca de". Excluido explícitamente por el usuario en esta spec.

---

## Risks

| Risk | Mitigation |
|---|---|
| `Home` usa `IntersectionObserver` (`useReveal`) que no existe en SSR | Se ejecuta dentro de `useEffect` en un componente `"use client"`, igual que el patrón ya usado en `SessionProvider` de SPEC 01. |
| Cambiar la ruta de Biblioteca de `/` a `/biblioteca` puede dejar enlaces/bookmarks viejos apuntando a `/` esperando la grilla de juegos | Aceptado: es el comportamiento pedido por el usuario; no se agrega redirect porque no hay usuarios externos todavía (proyecto en desarrollo). |
| Las nuevas clases CSS portadas podrían colisionar con nombres genéricos ya usados en otras pantallas | Verificado por grep antes de escribir esta spec: ninguna de las clases nuevas (`home-*`, `feature-card`, `mini-card`, `activity-card`, `pricing-grid`, `price-card`, `stat-block`, `final-cta`, etc.) existe hoy en `app/globals.css`. |

---

## What is **not** in this spec

- Pantalla "Acerca de" (`about.jsx`).
- Datos reales o dinámicos para "Actividad en vivo".
- Cambios a `GameCard`, `LibraryScreen`, `AuthScreen`, `HallOfFame` o `PlayerScreen`.
- Redirect de `/` viejo hacia `/biblioteca` para bookmarks externos.

Cada uno de estos, si se implementa, va en su propio spec.

# Auditoría mobile — mobile-porter

> Última actualización: 2026-08-18 (pasada `/auth`)

Checklist de referencia (ver `.claude/agents/mobile-porter.md`):

1. Sin scroll horizontal en 375–430px.
2. Todo botón/link interactivo ≥44px de alto.
3. Ningún texto de cuerpo baja de ~12px, ni queda cortado o superpuesto.
4. Tablas anchas con su propio scroll horizontal contenido.
5. Formularios usables con teclado móvil (`inputMode`, sin doble-tap-zoom).
6. Nada queda inalcanzable detrás del nav/hamburger.

## Estado por ruta

| Ruta            | Componente principal                                          | Estado    | Ítem(s) que fallaba                                                                                                                              | Trabajada en esta pasada |
| ---------------- | --------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `/juegos/[id]`  | `app/juegos/[id]/page.tsx`                                     | Completa  | Ítem 3: `.stat-strip .v` ("Mejor global") podía desbordarse/superponerse en ~390px con puntuaciones grandes (`toLocaleString` sin punto de corte, fuente pixel ancha, columna `1fr`). Ítems 1, 2 y 6 ya pasaban gracias a reglas globales existentes (`body{overflow-x:hidden}`, `.btn{min-height:44px}` bajo `@media (pointer: coarse)`, nav `sticky`). | No (pasada anterior)      |
| `/`             | `components/Home.tsx`                                          | Completa  | Ítem 2: `.lb-link` ("VER SALÓN →" en la card "TOP JUGADORES · HOY") es un `<a>` inline con `padding: 6px 10px` y `font-size: 9px` — altura real ≈25.5px, por debajo del umbral de 44px. Resto del checklist ya pasaba (ver detalle abajo). | Sí                        |
| `/biblioteca`   | `components/LibraryScreen.tsx` + `components/GameCard.tsx`      | Completa  | Ítem 2: los `.chip` de filtro (TODOS/ARCADE/PUZZLE/SHOOTER/VERSUS) medían ≈35px de alto (`padding: 12px 14px` + fuente pixel de 9px, sin `min-height`), por debajo del umbral de 44px. Ítem 5: `.av-search input` no tenía `type`/`inputMode`, y su `font-size: 13px` dispara auto-zoom al enfocar en iOS Safari (umbral 16px). Ítems 1, 3, 4, 6 ya pasaban (ver detalle abajo). | Sí                        |
| `/salon`        | `components/HallOfFame.tsx` (`.hall-table`)                     | Completa  | Ítems 1, 3 y 4: `.hall-table .tr`/`.th` (grid `50px 1fr 90px 90px` en mobile) no tenían `overflow-x` propio; un `player_name` de hasta 10 caracteres (CHECK `char_length between 1 and 10`) sin espacios es una palabra no partible, y el track `1fr` sólo tenía ~72px disponibles tras restar columnas fijas/gap/padding — el nombre podía desbordar y pintarse superpuesto sobre las columnas PUNTUACIÓN/FECHA en vez de forzar scroll contenido. Ítem 2 ya pasaba (`.chip` de `.hall-tabs` reusa la regla de `/biblioteca`; `.btn lg` de "VOLVER A LA BIBLIOTECA" ya cubierto). | Sí                        |
| `/auth`         | `app/auth/page.tsx` (`components/AuthScreen.tsx`)                | Completa  | Ítem 2: `.auth-tabs button` (INICIAR SESIÓN / CREAR CUENTA) medía ≈36px de alto (`padding: 12px`, fuente pixel 9px, sin `min-height`, sin clase `.btn`), por debajo del umbral de 44px. Ítem 5: los 3 `<input>` de `.field` heredaban el `font-size: 14px` del `body` (sin `font-size` propio); en iOS Safari cualquier input enfocado con fuente <16px dispara auto-zoom de página al hacer foco, y ninguno tenía `type`/`inputMode`/`autoComplete` explícitos más allá de `type="email"`/`type="password"` ya presentes. Ítems 1, 3, 4 y 6 ya pasaban (ver detalle abajo). | Sí                        |

## Detalle de esta pasada — `/auth`

Cambios en `app/globals.css`:

```css
/* dentro del bloque @media (pointer: coarse) ya existente, junto a .chip/.lb-link */
.auth-tabs button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
}

/* nuevo bloque, inline justo después de .field input:focus (mismo patrón de
   colocación que .podium usa dentro de la sección de /salon: el @media vive
   pegado a la regla base que modifica, en vez de agruparse aparte) */
@media (max-width: 720px) {
  .field input {
    font-size: 16px;
  }
}
```

Y en `components/AuthScreen.tsx`, sobre los 3 `<input>` del formulario:

```tsx
<input
  type="text"
  inputMode="text"
  autoComplete="username"
  autoCapitalize="off"
  autoCorrect="off"
  spellCheck={false}
  value={user}
  onChange={(e) => setUser(e.target.value)}
  placeholder="px_kai"
/>
{/* ... */}
<input
  type="email"
  inputMode="email"
  autoComplete="email"
  autoCapitalize="off"
  autoCorrect="off"
  spellCheck={false}
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  placeholder="jugador@vault.gg"
/>
{/* ... */}
<input
  type="password"
  autoComplete={tab === "in" ? "current-password" : "new-password"}
  value={pass}
  onChange={(e) => setPass(e.target.value)}
  placeholder="••••••••"
/>
```

- `.auth-tabs button` (INICIAR SESIÓN / CREAR CUENTA) es un `<button>` sin la clase `.btn` — no hereda el `min-height:44px` que SPEC 08 ya subió para `.btn`/`.skin-switch button` bajo `@media (pointer: coarse)`, y sus propios estilos (`padding: 12px`, fuente Press Start 2P de 9px, sin `min-height`) resuelven a ≈36px de alto real. Se sumó al mismo bloque `@media (pointer: coarse)` ya existente (línea ~1299), junto a `.chip`/`.lb-link` de pasadas anteriores, con el mismo patrón (`display: inline-flex; align-items: center; justify-content: center; min-height: 44px;`) — necesario porque `<button>` dentro de un contenedor `display: grid` (`.auth-tabs`) se blockifica y no centra su contenido solo con el `min-height`, igual que ya se documentó para `.chip`/`.lb-link`.
- `.field input` (Usuario, Correo electrónico, Contraseña) no declaraba `font-size` propio, así que heredaba el `font-size: 14px` del `body`. En iOS Safari, un `<input>` enfocado con `font-size` menor a 16px dispara un auto-zoom de página no solicitado — el mismo problema ya encontrado y corregido en `.av-search input` de `/biblioteca` (13px → 16px). Se agregó un `@media (max-width: 720px)` nuevo, colocado inline justo después de `.field input:focus` (siguiendo el mismo patrón de ubicación que usa el resto del archivo, p. ej. `.podium` con su `@media` pegado debajo de su regla base) — no existía previamente ningún `@media` dentro de la sección `/* ===== auth ===== */` para extender, así que este es el primero de esa sección, no uno suelto al final del archivo.
- En `components/AuthScreen.tsx` se agregaron atributos explícitos de teclado móvil a los 3 inputs, para cerrar completamente el ítem 5 del checklist ("formularios usables con teclado móvil: `inputMode` correcto"): `type="text"` + `inputMode="text"` + `autoComplete="username"` en Usuario (antes sin `type`, por defecto ya resolvía a texto pero sin ser explícito ni tener autocompletado); `inputMode="email"` + `autoComplete="email"` sumados a Correo electrónico (que ya tenía `type="email"`, correcto, pero sin autocompletado); `autoComplete` condicional (`current-password` en la pestaña de login, `new-password` en la de registro) en Contraseña, para que los gestores de contraseñas móviles ofrezcan autocompletar/generar en el momento correcto. `autoCapitalize="off"` + `autoCorrect="off"` + `spellCheck={false}` en Usuario y Correo (mismo patrón que el input de iniciales de `PlayerScreen.tsx`, SPEC 08 paso 10) evitan que el teclado móvil autocapitalice o sugiera correcciones sobre un nombre de usuario o un email, donde ninguna de las dos cosas tiene sentido.
- No hizo falta envolver nada en un `<div>` extra ni tocar el resto del marcado (`.auth-card`, `.auth-header`, `.social`, `.auth-divider`): el problema era de estilo (altura de botón, tamaño de fuente de input) y de atributos de input, no de estructura.
- Ítems ya cubiertos sin cambios, gracias a reglas preexistentes o al propio marcado de la ruta:
  - Ítem 1 (sin scroll horizontal en 375–430px): `body{overflow-x:hidden}` global. `.auth-card{width:min(440px,100%)}` dentro de `.av-auth-wrap{padding:60px 20px}` nunca excede el ancho de viewport — a 375px de ancho de viewport, el card resuelve a 335px (375 − 40 de padding lateral del wrap), muy por debajo del tope de 440px. `.auth-tabs` y `.social` son `grid-template-columns: 1fr 1fr` sin anchos fijos, así que se ajustan al ancho del card.
  - Ítem 2 (botones/links ≥44px, resto): el botón de submit (`.btn lg`, "ENTRAR AL VAULT"/"CREAR Y JUGAR"), "JUGAR COMO INVITADO" (`.btn ghost`) y "◆ GOOGLE"/"▣ GITHUB" (`.social .btn`, también `.btn ghost`) usan todos la clase `.btn`, ya cubierta por `.btn{min-height:44px}` bajo `@media (pointer: coarse)` desde SPEC 08 — `.btn` además ya trae `display:inline-flex; align-items:center; justify-content:center;` en su regla base (no condicional a `pointer: coarse`), así que el contenido queda centrado sin cambios adicionales. Los `<input>` de `.field` ya median `height: 44px` de antes, al filo del umbral pero sin fallarlo. El único control por debajo era `.auth-tabs button`, ya corregido arriba.
  - Ítem 3 (texto ≥~12px, sin cortes/superposición): el texto de cuerpo real de la ruta (labels de `.field`, 10px; "ACCESO AL SISTEMA · v2.6" y el aviso de términos, 11px inline; "O CONTINÚA CON", 8px) es la misma convención de micro-label/copy decorativo en fuente pixel o mono ya documentada en pasadas anteriores (kickers, `.chip`, `.stat-strip .l`), no una regresión de esta ruta — ninguno se corta ni se superpone: todos son `<div>`/`<label>` de bloque sin `white-space: nowrap` ni ancho fijo, así que envuelven en varias líneas si hace falta en vez de desbordar. Revisé el caso más ajustado ("ACCESO AL SISTEMA · v2.6" y el aviso de términos, ambos centrados dentro de un contenido de card de ~279px en el extremo de 375px) y ninguno se acerca al límite de una sola línea sin espacio para envolver.
  - Ítem 4 (tablas anchas con scroll propio): no aplica, `/auth` no tiene tablas.
  - Ítem 6 (nada detrás del nav): `Nav.tsx` es `sticky`, no `fixed`; `/auth` no tiene overlays propios.

## Verificación de esta pasada — `/auth`

- `npm run lint`: sin errores.
- `npm run build`: sin errores (`/auth` sigue listada como `○` estática, sin cambios de tipo de render).
- Verificación visual con la extensión de Chrome (`mcp__claude-in-chrome`): **no se hizo** — la extensión no está disponible/conectada en esta sesión. La verificación se basó en lint + build + revisión de código (cálculo de la altura real de `.auth-tabs button` con su padding/fuente, y confirmación de que `.field input` heredaba el `font-size: 14px` del `body` en vez de declarar el propio).
- Guion manual pendiente para el usuario: abrir `/auth` en DevTools a ~390×844 con puntero táctil emulado, confirmar que no hay scroll horizontal, que "INICIAR SESIÓN"/"CREAR CUENTA" son cómodos de tocar (~44px de alto), que tocar cualquiera de los 3 campos del formulario no dispara un zoom automático de página, que el teclado que abre cada campo es el esperado (texto para Usuario, con `@` para Correo, oculto para Contraseña), y que en desktop (puntero fine) la pantalla se ve exactamente igual que antes del cambio.

## Detalle de esta pasada — `/salon`

Cambio en `app/globals.css`, dentro del bloque `@media (max-width: 720px)` ya existente (el mismo que ya reducía `.hall-table .th`/`.tr` a `grid-template-columns: 50px 1fr 90px 90px`, sin crear un `@media` suelto):

```css
.hall-table {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.hall-table .th,
.hall-table .tr {
  grid-template-columns: 50px 1fr 90px 90px;
  font-size: 12px;
  padding: 10px 12px;
  min-width: fit-content;
}
.hall-table .tr .pl {
  white-space: nowrap;
}
```

- Diagnóstico: `.hall-table .tr` es un `display: grid` cuya caja exterior (block-level) se estira al ancho de `.hall-table` (que a su vez llena `.av-hall`, ~332px de ancho de contenido en 375–390px tras el padding de 16px de esta ruta). Con las columnas fijas en mobile (`50px + 90px + 90px = 230px` más `30px` de `gap` y `24px` de `padding` lateral de la fila), a la columna `1fr` de JUGADOR le quedan sólo ~72px. `player_name` acepta hasta 10 caracteres (`char_length(player_name) between 1 and 10`, `supabase/migrations/0001_games_scores.sql`) y normalmente es una sola palabra sin espacios — texto no partible. A ~7.2px/carácter en mono 12px, un nombre de 10 caracteres mide ~72px, al filo o por encima del espacio disponible. Sin `min-width` propio, una caja `grid` de ancho fijo no crece para dar cabida a contenido que no entra: el texto se pinta con `overflow: visible` (el valor por defecto) por encima de las columnas vecinas (PUNTUACIÓN/FECHA) en vez de forzar un scroll — el ítem 3 del checklist ("texto... cortado o superpuesto") se rompía exactamente así, no como scroll de página completa (que además `body{overflow-x:hidden}` recorta sin avisar).
- Fix: `min-width: fit-content` en `.hall-table .th`/`.tr` deja que la fila crezca a su ancho de contenido real cuando ese contenido no entra (sin cambiar nada cuando sí entra — `fit-content` sólo actúa como piso, no fuerza el ancho si el layout normal ya alcanza), y `overflow-x: auto` en el contenedor `.hall-table` (junto con `-webkit-overflow-scrolling: touch` para inercia en iOS) contiene ese desborde con scroll horizontal propio de la tabla — exactamente el ítem 4 del checklist, sin que la página entera se ensanche ni dispare su propio scroll (`.av-hall`/`body` no cambian). `.hall-table .tr .pl` suma `white-space: nowrap` para que un nombre con espacio interno (el esquema no lo prohíbe) también se trate como una sola unidad y el cálculo de `fit-content` sea consistente.
- No se tocó `components/HallOfFame.tsx`: no hizo falta envolver `.hall-table` en un `<div>` extra — al ya ser un contenedor de bloque propio, `overflow-x: auto` alcanza directamente sin marcado nuevo.
- Ítems ya cubiertos sin cambios, gracias a reglas preexistentes o al propio marcado de la ruta:
  - Ítem 1 (sin scroll horizontal de página en 375–430px): `body{overflow-x:hidden}` global; con el fix de arriba, cualquier desborde de `.hall-table` queda contenido en su propio scroll, no en el de la página. El resto de la ruta (`.hall-head`, `.podium` con `grid-template-columns: 1fr` bajo `@media (max-width: 720px)`, `.hall-tabs` con `flex-wrap: wrap`) ya cabía sin desbordar.
  - Ítem 2 (botones/links ≥44px): los `.chip` de `.hall-tabs` (TODOS/ARCADE/... por juego) reusan la misma clase que `LibraryScreen.tsx`, ya subida a `min-height: 44px` en la pasada de `/biblioteca` (`@media (pointer: coarse)`) — `HallOfFame.tsx` no define un `.chip` propio, es la misma regla CSS. El link "VOLVER A LA BIBLIOTECA" usa `.btn lg`, ya cubierto por `.btn{min-height:44px}` de SPEC 08. No hay más elementos interactivos en la ruta (las filas de la tabla no son clicables).
  - Ítem 3 (texto ≥~12px, sin cortes/superposición): ya resuelto arriba para la tabla. El subtítulo "LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA" en 10px es la misma convención de micro-label pixel documentada en pasadas anteriores (kickers/labels decorativos en todo el sitio), no una regresión de esta ruta. El resto del texto de cuerpo (`.podium-slot .name/.score/.date`, `.hall-table .tr .pl/.sc/.dt`) ya está en 11–20px.
  - Ítem 5 (formularios): no aplica, `/salon` no tiene formularios.
  - Ítem 6 (nada detrás del nav): `Nav.tsx` es `sticky`, no `fixed`; `/salon` no tiene overlays propios.

## Detalle de esta pasada — `/biblioteca`

Cambios en `app/globals.css`:

```css
/* dentro del bloque @media (pointer: coarse) ya existente, junto a .lb-link */
.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
}

/* dentro del bloque @media (max-width: 720px) ya existente, junto a .av-filters */
.av-search input {
  font-size: 16px;
}
```

Y en `components/LibraryScreen.tsx`, sobre el `<input>` de búsqueda:

```tsx
<input
  type="search"
  inputMode="search"
  enterKeyHint="search"
  autoComplete="off"
  value={q}
  onChange={(e) => setQ(e.target.value)}
  placeholder="Buscar un juego por nombre…"
/>
```

- `.chip` (los 5 botones de filtro TODOS/ARCADE/PUZZLE/SHOOTER/VERSUS en `LibraryScreen.tsx`) sólo tenían `padding: 12px 14px` y fuente pixel de 9px, sin `min-height` — altura real ≈35px, por debajo del umbral de 44px que ya usó SPEC 08 para `.btn`/`.skin-switch button`. Se sumó `.chip` al mismo bloque `@media (pointer: coarse)` que ya sube esos otros controles a 44px (mismo bloque donde la pasada anterior agregó `.lb-link`, sin crear un `@media` suelto). Como `<button>` no centra su contenido automáticamente al forzar un `min-height` mayor al alto natural del texto, se agregó `display: inline-flex; align-items: center; justify-content: center;` — mismo patrón que `.btn` ya trae en su regla base (línea ~337) y que la pasada de `/` ya usó para `.lb-link`. Confirmé que `.chip` es exclusivo de `LibraryScreen.tsx` (`grep` no lo encuentra en ningún otro componente), así que el cambio queda acotado a esta ruta.
- `.av-search input` (campo de búsqueda, exclusivo de esta ruta) tenía `font-size: 13px` fijo. En iOS Safari, cualquier `<input>` enfocado con `font-size` menor a 16px dispara un zoom automático de la página — un tipo de zoom no solicitado que cae dentro del ítem 5 del checklist ("formularios usables con teclado móvil ... sin doble-tap-zoom accidental"). Se subió a 16px sólo dentro del bloque `@media (max-width: 720px)` ya existente (el mismo que ya toca `.av-filters`, `.av-grid` y `.av-hero` de esta misma ruta), sin tocar el `font-size: 13px` de escritorio.
- En el componente se agregó `type="search"` (habilita el botón "buscar"/clear nativo del teclado móvil en vez de un teclado de texto genérico), `inputMode="search"` y `enterKeyHint="search"` (etiqueta la tecla Enter del teclado virtual como "Buscar") y `autoComplete="off"` (evita sugerencias de autocompletado de nombres de usuario/dirección que un navegador podría ofrecer sobre un campo de texto libre sin atributo `type`). Esto sí fue un cambio de marcado, no sólo CSS — justificado porque el problema (falta de `inputMode` correcto) es del componente, no resoluble únicamente desde `globals.css`.
- Ítems ya cubiertos sin cambios, gracias a reglas preexistentes o al propio marcado de la ruta:
  - Ítem 1 (sin scroll horizontal en 375–430px): `body{overflow-x:hidden}` global. `.av-filters` tiene `flex-wrap: wrap` (la búsqueda y los chips pasan a su propia fila si no entran), y `.av-grid` usa `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`, que en 375–430px de ancho (343–398px de contenido tras el padding de 16px por lado bajo `@media (max-width: 720px)`) resuelve siempre en una sola columna sin desbordar. Revisé el contenido interno de `.card` (`.row` con `.score-badge` + botón "JUGAR"): con el ancho de card más angosto del rango (~311px tras el padding de 14px del `.card`), "MEJOR PUNTUACIÓN" (10px mono, ~17 caracteres) más el botón "JUGAR" caben con margen de sobra.
  - Ítem 2 (botones/links ≥44px): el botón "JUGAR" de `GameCard` usa la clase `.btn`, ya cubierta por `.btn{min-height:44px}` bajo `@media (pointer: coarse)`; la propia `<Link className="card">` que envuelve cada tarjeta es mucho más alta que 44px. El único control por debajo del umbral eran los `.chip`, ya corregidos.
  - Ítem 3 (texto ≥~12px, sin cortes/superposición): `.card .title` (13px) y `.card .desc` (12px, con `min-height: 36px` que sólo crece si el texto es más largo, nunca corta ni superpone) ya cumplen. Las micro-etiquetas por debajo de 12px (`.chip` 9px, `.card .cover .label` 8px, `.score-badge` 10px) son la misma convención pixel-font ya documentada en pasadas anteriores (`.btn` en sí mismo usa 10px) — no una regresión de esta ruta, y ninguna se corta o superpone (`.cover .label` es una palabra corta sobre una portada de ancho fijo; `.score-badge` mide bien holgado dentro de `.row`).
  - Ítem 4 (tablas anchas con scroll propio): no aplica, `/biblioteca` no tiene tablas.
  - Ítem 6 (nada detrás del nav): `Nav.tsx` es `sticky`, no `fixed`; `/biblioteca` no tiene overlays propios (el panel móvil de `Nav.tsx` sólo se despliega al abrir el hamburger y no cubre contenido por defecto).

## Detalle de esta pasada — `/`

Cambio en `app/globals.css`, dentro del bloque `@media (pointer: coarse)` ya existente (mismo bloque que ya subía `.btn` y `.skin-switch button` a 44px de alto en SPEC 08, sin crear un `@media` suelto):

```css
.lb-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}
```

- `.lb-link` (usado únicamente en `components/Home.tsx`, en la card "TOP JUGADORES · HOY" de la sección "ACTIVIDAD EN VIVO") es un `<a>` sin `display` propio, o sea `inline` por defecto — `min-height` no tiene efecto en elementos inline no reemplazados, así que además de subir la altura mínima hubo que añadir `display: inline-flex; align-items: center;` para que la regla realmente aplique y el texto quede centrado verticalmente en la caja más alta (mismo motivo por el que `.btn` ya trae `display: inline-flex` en su definición base, línea ~337). Verificado que `.lb-link` no se usa en ninguna otra ruta (`grep` sólo lo encuentra en `Home.tsx` y `globals.css`, más las plantillas estáticas de `references/templates/` que están fuera de alcance de lint/build), así que el cambio queda acotado a esta ruta.
- No se tocó ningún componente (`components/Home.tsx` no requería cambios de marcado): el problema era puramente de CSS.
- Ítems ya cubiertos sin cambios, gracias a reglas preexistentes o al propio marcado de la ruta:
  - Ítem 1 (sin scroll horizontal en 375–430px): `body{overflow-x:hidden}` global. Revisé caso por caso los elementos con mayor riesgo de desborde (`.home-title` con `clamp(32px, 7vw, 88px)`, `.pc-stamp` con `position:absolute; right:-18px` sobre `.price-card`, `.hero-eyebrow`) — ninguno excede el ancho de viewport en el rango 375–430px; los grids con más de una columna (`.feature-grid`, `.mini-rail`, `.stats-inner`, `.activity-grid`, `.pricing-grid`, `.tick-row`) ya colapsan a 1 o 2 columnas bajo sus propios `@media (max-width: …)` existentes.
  - Ítem 2 (botones/links ≥44px): todos los `<Link className="btn ...">` (EXPLORAR JUEGOS, CREAR CUENTA, VER TODOS LOS JUEGOS, EMPEZAR GRATIS, INSERTAR MONEDA) ya quedan cubiertos por `.btn{min-height:44px}` bajo `@media (pointer: coarse)`; `MiniCard` es un `<Link>` que envuelve toda la portada + metadata (mucho más alto que 44px). El único que fallaba era `.lb-link`, ya corregido.
  - Ítem 3 (texto ≥~12px, sin cortes/superposición): el texto de cuerpo real (`.home-sub` 15px, `.pc-list li` 13px, `.faq-a` 13px) ya cumple. Las micro-etiquetas pixel por debajo de 12px (`.kicker`, `.pc-label`, `.pc-tag`, `.tk-t`, `.tp-rk`, `.hero-eyebrow`, `.ac-title`, `.stat-s`, ahora también `.lb-link` en tamaño de fuente) son una convención visual consistente en todo el sitio (ya documentada en la pasada de `/juegos/[id]`), no una regresión de esta ruta — no se tocaron. Ninguna se corta ni se superpone: `.ac-title` ya usa `overflow:hidden; text-overflow:ellipsis; white-space:nowrap` a propósito, y los grids de dos-tres columnas con texto variable (`.top-row`, `.tick-row`) caben con margen en 375px con los nombres/puntajes reales de las constantes `RECENT_SCORES`/`TOP_PLAYERS`.
  - Ítem 4 (tablas anchas con scroll propio): no aplica, `/` no tiene tablas.
  - Ítem 5 (formularios): no aplica, `/` no tiene formularios.
  - Ítem 6 (nada detrás del nav): `Nav.tsx` es `sticky`, no `fixed`; `/` no tiene overlays propios.

## Detalle de la pasada anterior — `/juegos/[id]`

Cambios en `app/globals.css`, dentro del bloque `@media (max-width: 720px)` ya existente (mismo que ya tocaba `.av-detail`, sin crear un `@media` suelto):

```css
.detail-tags span {
  font-size: 10px;
}
.stat-strip .v {
  font-size: 12px;
  overflow-wrap: anywhere;
}
```

- `.stat-strip .v` (valor de "Mejor global", fuente Press Start 2P): con puntuaciones de hasta 10.000.000 (tope del CHECK de `scores.score`) y columnas `1fr` sin `min-width: 0`, el número formateado (`toLocaleString("es-ES")`, sin espacios) podía exceder el ancho disponible de la celda y desbordarse/superponerse sobre las columnas vecinas — la única forma real de romper el checklist que encontré en esta ruta. Se bajó a 12px (mismo tamaño que usó SPEC 08 para `.hud-stat .v` en `/jugar`) y se añadió `overflow-wrap: anywhere` como red de seguridad para que un número largo rompa de línea en vez de desbordar.
- `.detail-tags span` subido de 9px a 10px (el tamaño más chico de la página) para alinearlo con el resto de micro-labels pixel del sitio (`.stat-strip .l` y `.lb-row .rk` ya usan 10–11px). Sigue por debajo del ideal de ~12px, pero es una convención de diseño (badges decorativos en fuente pixel) presente en todo el sitio, no una regresión de esta ruta — subir todos esos labels a 12px sería un rediseño del lenguaje visual, fuera de alcance de una pasada aditiva de una sola ruta.
- No se tocó ningún componente (`app/juegos/[id]/page.tsx` no requería cambios de marcado): el problema era puramente de CSS.
- Ítems ya cubiertos sin cambios, gracias a reglas preexistentes fuera de esta pasada: `.btn{min-height:44px}` bajo `@media (pointer: coarse)` (línea ~1341 de `globals.css`) ya cubre "▶ JUGAR AHORA" y "VOLVER AL VAULT"; `body{overflow-x:hidden}` evita scroll horizontal de página; `.av-detail{grid-template-columns:1fr}` bajo 900px evita el layout de 2 columnas en móvil; `Nav.tsx` es `sticky`, no `fixed`, así que nunca tapa contenido.

## Verificación de esta pasada — `/salon`

- `npm run lint`: sin errores.
- `npm run build`: sin errores (`/salon` sigue listada como `ƒ` dinámica, sin cambios de tipo de render).
- Verificación visual con la extensión de Chrome (`mcp__claude-in-chrome`): **no se hizo** — la herramienta no está disponible/conectada en esta sesión. La verificación se basó en lint + build + revisión de código (cálculo de anchos de columna del grid `.hall-table` en mobile contra el límite real de 10 caracteres de `player_name` fijado por el CHECK de `supabase/migrations/0001_games_scores.sql`).
- Guion manual pendiente para el usuario: abrir `/salon` en DevTools a ~390×844 con puntero táctil emulado, elegir una pestaña con un puntaje de un jugador con nombre de 10 caracteres (o insertar uno de prueba), confirmar que la fila ya no superpone el nombre sobre PUNTUACIÓN/FECHA — en su lugar la tabla debe permitir un pequeño scroll horizontal contenido dentro de sí misma si el nombre no entra —, que los chips de juego y "VOLVER A LA BIBLIOTECA" son cómodos de tocar, y que en desktop (puntero fine) la pantalla se ve exactamente igual que antes del cambio.

## Verificación de esta pasada — `/biblioteca`

- `npm run lint`: sin errores.
- `npm run build`: sin errores (`/biblioteca` sigue listada como `ƒ` dinámica, sin cambios de tipo de render).
- Verificación visual con la extensión de Chrome (`mcp__claude-in-chrome`): **no se hizo** — la extensión no está disponible/conectada en esta sesión (no figura entre las herramientas habilitadas). La verificación se basó en lint + build + revisión de código (cálculo de alturas de `.chip` con padding + fuente Press Start 2P, y de anchos de `.av-grid`/`.card` en el rango 375–430px).
- Guion manual pendiente para el usuario: abrir `/biblioteca` en DevTools a ~390×844 con puntero táctil emulado, confirmar que no hay scroll horizontal, que los chips de categoría (TODOS/ARCADE/PUZZLE/SHOOTER/VERSUS) miden ~44px de alto y son cómodos de tocar, que el campo de búsqueda no dispara zoom automático al enfocarlo (o que el teclado abre en modo "buscar"), y que en desktop (puntero fine) la pantalla se ve exactamente igual que antes del cambio.

## Verificación de esta pasada — `/`

- `npm run lint`: sin errores.
- `npm run build`: sin errores (`/` compila igual que antes; la ruta sigue listada como `ƒ` dinámica sin cambios de tipo de render).
- Verificación visual con la extensión de Chrome (`mcp__claude-in-chrome`): **no se hizo** — la extensión no está conectada en esta sesión. La verificación se basó en lint + build + revisión de código (cálculo de anchos con la fuente Press Start 2P a distintos tamaños de columna/viewport entre 375–430px).
- Guion manual pendiente para el usuario: abrir `/` en DevTools a ~390×844, confirmar que no hay scroll horizontal, que "VER SALÓN →" (card "TOP JUGADORES · HOY") ahora es cómodo de tocar (~44px de alto) y centra su texto, y que en desktop la sección se ve igual que antes del cambio (el link no cambia de tamaño con puntero fine).

## Verificación de la pasada anterior — `/juegos/[id]`

- `npm run lint`: sin errores.
- `npm run build`: sin errores (`/juegos/[id]` compila y prerenderiza igual que antes).
- Verificación visual con la extensión de Chrome (`mcp__claude-in-chrome`): **no se hizo** — la extensión no está conectada en esa sesión. La verificación se basó en lint + build + revisión de código (cálculo de anchos de fuente Press Start 2P vs. ancho de columna a 390px).
- Guion manual pendiente para el usuario: abrir `/juegos/<id>` (idealmente uno con `best` de varios millones) en DevTools a ~390×844, confirmar que "Mejor global" no se corta ni se superpone, y que en desktop la pantalla se ve igual que antes del cambio.

## Pendientes

Ninguna. Las 5 rutas que SPEC 08 dejó fuera de su alcance (`/`, `/biblioteca`, `/juegos/[id]`, `/salon`, `/auth`) están `Completa`. No hay trabajo de `mobile-porter` pendiente hasta que algo cambie en alguna de esas rutas.

# SPEC 06 — Leaderboard real (lectura y escritura de puntuaciones)

> **Status:** Aprobado
> **Depends on:** SPEC 05
> **Date:** 2026-08-14
> **Objective:** Sustituir todas las puntuaciones mock por lecturas y escrituras reales de la tabla `scores`, eliminando `seededScores` y `av_scores`.

---

## Por qué este spec

SPEC 05 dejó el esquema (`games`, `scores`, RLS, `game_stats`) y migró el catálogo a la BD, pero explícitamente sin tocar ninguna lectura ni escritura de puntuaciones: `/salon` y `/juegos/[id]` siguen mostrando `seededScores()` (inventado en cada render) y `PlayerScreen` sigue guardando en `localStorage` (`av_scores`). Este spec conecta ambos extremos: lee `scores` real donde antes se inventaba, y escribe en `scores` real donde antes se escribía en el navegador. Al no haber autenticación todavía (queda fuera de SPEC 05 y de este spec), la escritura usa la política de INSERT anónimo con CHECK constraints que SPEC 05 ya creó en el esquema — es una defensa parcial, documentada como riesgo aceptado, no una solución definitiva.

---

## Scope

**In:**

- `lib/queries.ts`: `getTopScores(gameId: string, limit: number): Promise<ScoreRow[]>` (orden `score desc, created_at asc`, `rank` calculado en la respuesta) y `getAllTopScores(gameIds: string[], limit: number): Promise<Record<string, ScoreRow[]>>` para precargar los datos de todas las pestañas del Salón en una sola carga de servidor.
- `app/juegos/[id]/page.tsx`: el aside "MEJORES PUNTUACIONES" (10 filas) pasa a leer `getTopScores(id, 10)` en vez de `seededScores(id.length * 17 + 3, 10)`.
- `app/salon/page.tsx`: además de `getGames()` (de SPEC 05), obtiene `getAllTopScores(gameIds, 12)` y pasa ambos a `HallOfFame` por props.
- `components/HallOfFame.tsx`: recibe `scoresByGame: Record<string, ScoreRow[]>` por prop; el cambio de pestaña selecciona del objeto ya cargado (sin nuevas queries en cliente). Podio top-3 y tabla de 12 filas muestran datos reales.
- La fila "TU MEJOR MARCA EN [JUEGO]" pasa de inventada (`rows[5].score - 2400`, rango `8 + tab.length % 4`) a la mejor puntuación real con `player_name = user.name` dentro de las filas ya cargadas del juego activo, con su rango real dentro de esa lista; si el usuario no tiene puntuación en ese juego, la fila no se renderiza.
- `components/SessionProvider.tsx`: `saveScore` pasa a ser `async`, inserta en `scores` con el cliente de browser (`lib/supabase/client.ts`, ya existente desde SPEC 03) y devuelve `{ ok: true } | { ok: false; error: string }` en vez de escribir `av_scores`.
- `components/PlayerScreen.tsx`: el botón GUARDAR PUNTUACIÓN se deshabilita mientras el `saveScore` está en curso, muestra "▸ PUNTUACIÓN GUARDADA_" solo si `ok: true`, y un mensaje de error visible (reutilizando el estilo `.toast-saved` con una variante de color) si `ok: false`, con el botón reactivado para reintentar. Aplica a los 8 juegos del catálogo — todos insertan en `scores`, no solo `asteroides`.
- Estados vacíos: si `getTopScores`/`getAllTopScores` devuelve 0 filas para un juego, el podio y la tabla de `HallOfFame` y el aside de `app/juegos/[id]/page.tsx` muestran "AÚN NO HAY PUNTUACIONES" en vez de acceder a `rows[0]`/`rows[1]`/`rows[2]` indefinidos.
- Limpieza: se elimina `seededScores` y `PLAYERS` de `lib/games.ts` (ya sin usos tras este spec), y toda lectura/escritura de la clave `av_scores` de `localStorage`.

**Out of scope (for future specs):**

- Autenticación real; `user_id` en `scores` sigue en `null` y el nombre del jugador sigue siendo el texto libre del modal de fin de partida.
- Datos reales en la sección "Actividad en vivo" del home (`components/Home.tsx`) — SPEC 02 la dejó con arrays de ejemplo estáticos; sigue igual, no se deriva de `scores`.
- Realtime/suscripciones a cambios de `scores` — el leaderboard se lee de nuevo en cada request de servidor, sin actualización en vivo mientras la pestaña está abierta.
- Paginación del Salón más allá de las 12 filas actuales por pestaña.
- Moderación, edición o borrado de puntuaciones desde la UI, y cualquier rate limiting adicional a los CHECK constraints ya creados en SPEC 05.
- Que los 7 juegos con mock de gameplay (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) dejen de sumar puntaje aleatorio por `setInterval` — siguen exactamente igual; sus puntuaciones finales, aunque falsas en origen, se guardan como reales en `scores` igual que las de `asteroides`.
- Tests automatizados (no hay test runner configurado en `package.json`).

---

## Data model

Este spec no introduce tablas ni columnas nuevas; reutiliza `scores` y la política de INSERT anónimo definidas en SPEC 05. El único tipo nuevo es la forma de retorno de las queries:

```ts
// lib/queries.ts
type ScoreRow = { rank: number; name: string; score: number; date: string }; // ya existe en lib/games.ts, sin cambios

function getTopScores(gameId: string, limit: number): Promise<ScoreRow[]>;
function getAllTopScores(gameIds: string[], limit: number): Promise<Record<string, ScoreRow[]>>;
```

```ts
// components/SessionProvider.tsx
type SaveScoreResult = { ok: true } | { ok: false; error: string };
saveScore(entry: { game: string; score: number; name: string }): Promise<SaveScoreResult>;
```

---

## Implementation plan

1. Añadir `getTopScores` y `getAllTopScores` a `lib/queries.ts`, usando el cliente de servidor de SPEC 05. Verificación: invocarlas desde una página temporal y confirmar que `getTopScores('asteroides', 10)` devuelve las 12 filas sembradas por SPEC 05, ordenadas por score.
2. Editar `app/juegos/[id]/page.tsx` para usar `getTopScores(id, 10)` en vez de `seededScores`; añadir el estado vacío "AÚN NO HAY PUNTUACIONES" cuando el array vuelve vacío. Verificación manual: `/juegos/asteroides` muestra las mismas 12→10 filas sembradas; confirmar visualmente que coinciden con `select * from scores where game_id='asteroides' order by score desc limit 10` por MCP.
3. Editar `app/salon/page.tsx` para cargar `getAllTopScores(gameIds, 12)` y pasarlo a `HallOfFame`; editar `HallOfFame.tsx` para leer de la prop en vez de llamar `seededScores` en el render, y añadir el estado vacío del podio/tabla. Verificación manual: `/salon` muestra los mismos datos sembrados por juego, cambiar de pestaña no dispara requests nuevos (los datos ya están cargados).
4. Editar `SessionProvider.tsx`: `saveScore` async, insertando en `scores` con el cliente de browser, devolviendo `SaveScoreResult`. Verificación: llamar `saveScore` desde la consola del navegador y confirmar por MCP (`select ... order by created_at desc limit 1`) que la fila aparece en `scores`.
5. Editar `PlayerScreen.tsx`: `await saveScore(...)`, deshabilitar el botón durante el guardado, mostrar éxito/error según el resultado. Verificación manual: jugar `/jugar/asteroides`, terminar la partida, guardar, ver "PUNTUACIÓN GUARDADA"; simular un error (p. ej. nombre vacío bloqueado por el CHECK) y ver el mensaje de error con el botón reactivado.
6. Recorrer `PlayerScreen.tsx` para confirmar que el flujo de guardado ya no depende de `game.id === "asteroides"` en ningún punto — los 7 juegos mock también deben insertar en `scores` con su puntaje del ticker aleatorio. Verificación manual: jugar y guardar en `/jugar/bloque-buster`, confirmar la fila en `scores` con `game_id = 'bloque-buster'`.
7. Eliminar `seededScores` y `PLAYERS` de `lib/games.ts`; eliminar toda referencia a `av_scores` en el repo. Verificación: `grep -r "seededScores\|av_scores" --include=*.ts --include=*.tsx` sin resultados.
8. Probar el estado vacío end-to-end: borrar por MCP todas las filas de `scores` de un juego (`delete from scores where game_id = 'X'`), confirmar que `/salon` (pestaña X), `/juegos/X` y el podio muestran "AÚN NO HAY PUNTUACIONES" sin errores de consola; volver a sembrar esas filas o dejarlo así si el usuario prefiere probarlo en vivo.
9. Pasada final: `npm run lint` y `npm run build` sin errores; recorrido manual completo — jugar y guardar en `/jugar/asteroides`, confirmar que la fila aparece en `/salon` y en `/juegos/asteroides` tras recargar; intentar guardar con datos inválidos y confirmar el rechazo visible.

---

## Acceptance criteria

- [ ] `app/juegos/[id]/page.tsx` muestra el top 10 real de `scores` para ese juego, no `seededScores`.
- [ ] `/salon` muestra podio y tabla reales por pestaña, cargados desde `getAllTopScores` sin requests adicionales al cambiar de pestaña.
- [ ] Jugar `/jugar/asteroides`, terminar la partida y pulsar GUARDAR PUNTUACIÓN inserta una fila real en `scores` (verificable por MCP: `select * from scores order by created_at desc limit 1` devuelve esa fila con el nombre escrito en el modal).
- [ ] Esa misma puntuación aparece en `/salon` (pestaña de ese juego) y en `/juegos/asteroides` tras recargar la página.
- [ ] Guardar una puntuación en cualquiera de los 7 juegos mock también inserta en `scores` con el `game_id` correspondiente.
- [ ] La fila "TU MEJOR MARCA EN [JUEGO]" solo aparece cuando el usuario tiene al menos una puntuación real en ese juego, y muestra su score y rango reales.
- [ ] Un intento de guardado con `player_name` de más de 10 caracteres o `score` negativo es rechazado por la base y la UI muestra un mensaje de error, con el botón GUARDAR PUNTUACIÓN reactivado para reintentar.
- [ ] Con un juego sin ninguna fila en `scores`, el podio, la tabla del Salón y el aside de la ficha muestran "AÚN NO HAY PUNTUACIONES" sin lanzar errores en consola.
- [ ] `grep -r "seededScores\|av_scores"` no encuentra resultados en el repo.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

---

## Decisions

- **Sí:** `getAllTopScores` precarga las 8 pestañas del Salón en una sola función de servidor, en vez de que `HallOfFame` dispare una query por cada cambio de pestaña. Evita convertir `HallOfFame` en un componente que necesita loading state por pestaña, manteniendo la interacción instantánea que ya tiene hoy con datos mock.
- **No:** cargar los datos del Salón por pestaña bajo demanda con `useEffect` — descartado por introducir un parpadeo de carga que no existe hoy y que SPEC 01 identificó como un bug real en otro contexto (ver decisión de `#root` en SPEC 01).
- **Sí:** todos los juegos del catálogo guardan en `scores`, incluidos los 7 con mock de gameplay. Mantener un camino de guardado distinto solo para `asteroides` dejaría dos flujos de persistencia conviviendo sin necesidad real; el ticker aleatorio ya "es" el gameplay de esos juegos en este MVP.
- **No:** que solo `asteroides` guarde en Supabase y el resto siga en `localStorage` — descartado por la razón anterior; se documenta como riesgo aceptado que el leaderboard se ensucie con puntajes de tickers aleatorios.
- **Sí:** eliminar `av_scores` y `seededScores` por completo en este spec. Mantenerlos como fallback offline dejaría dos fuentes de puntuaciones que nunca se reconcilian entre sí.
- **No:** mantener `av_scores` como fallback si el insert a Supabase falla — descartado por la razón anterior; en su lugar, un insert fallido se comunica al usuario y puede reintentar.
- **No:** conservar `seededScores` en `lib/games.ts` como utilidad para regenerar datos de siembra — descartado porque, sin usos en el código de producción tras este spec, sería código muerto; si se necesita volver a sembrar datos de prueba, se puede recuperar del historial de git.
- **Sí:** estados vacíos explícitos ("AÚN NO HAY PUNTUACIONES") en las tres vistas que leen `scores`. Necesario porque, a diferencia del mock (que siempre generaba 12 filas), la BD real puede legítimamente no tener puntuaciones para un juego nuevo o recién limpiado.
- **No:** dejar los estados vacíos sin diseñar y confiar en que `scores` siempre tendrá datos porque SPEC 05 la sembró — descartado porque es frágil (cualquier borrado manual o futuro spec que reinicie datos rompería la UI).

---

## Risks

| Risk                                                                                                                                                                        | Mitigation                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El INSERT anónimo (rol `anon`) permite que cualquiera con la clave publishable inserte puntuaciones arbitrarias en cualquier juego                                          | Aceptado: los CHECK constraints de SPEC 05 acotan el daño (rango de score, longitud de nombre, `game_id` válido) pero no impiden falsificación deliberada; mitigación real solo llega con autenticación, en un spec futuro. |
| Los 7 juegos con ticker aleatorio siguen generando puntuaciones sin relación con habilidad real, y ahora persisten en `scores` en vez de perderse en `localStorage`         | Aceptado como parte del alcance de este MVP: ya era el comportamiento visible hoy, solo cambia dónde se guarda.                                                                                                             |
| El rango mostrado (`rank`) se calcula en cada consulta y no está materializado; dos puntuaciones con el mismo `score` se desempatan por `created_at`                        | Aceptado: mismo criterio de orden estable que usaría cualquier `ORDER BY score DESC, created_at ASC`; no requiere columna adicional.                                                                                        |
| `saveScore` ahora depende de red (Supabase) en vez de ser síncrono contra `localStorage`; una conexión lenta o caída deja el botón deshabilitado más tiempo o muestra error | Aceptado: el mensaje de error visible y el botón reactivado para reintentar (criterio de aceptación) cubren el caso; no se implementa reintento automático ni cola offline en este spec.                                    |

---

## What is **not** in this spec

- Autenticación de cualquier tipo.
- Datos reales para "Actividad en vivo" del home.
- Realtime/suscripciones al leaderboard.
- Paginación más allá de las 12 filas por pestaña.
- Moderación, edición o borrado de puntuaciones desde la UI.
- Que los juegos mock dejen de usar un ticker de puntaje aleatorio.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.

# SPEC 05 — Tabla de juegos y puntuaciones en Supabase

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 03
> **Date:** 2026-08-14
> **Objective:** Crear las tablas `games` y `scores` en Supabase (con RLS y datos sembrados), añadir el cliente de servidor, y convertir `games` en la única fuente de verdad del catálogo eliminando `GAMES`/`getGame` de `lib/games.ts`.

---

## Por qué este spec

SPEC 03 dejó Supabase instalado pero la base vacía (0 tablas, 0 migraciones, verificado por MCP) y descartó explícitamente tablas y cliente de servidor para un spec futuro. Hoy los 8 juegos son un array hardcodeado en `lib/games.ts` (`GAMES`) y las puntuaciones de cada ficha/salón se generan con `seededScores()`, una función determinista que inventa nombres y puntajes en cada render. Este spec construye el esquema de base de datos que sostiene ambas cosas y migra la lectura del catálogo a la BD. Conectar el leaderboard real (lectura de `scores` desde `/salon`/`/juegos/[id]` y escritura desde `PlayerScreen`) queda para SPEC 06 — mezclar ambos en un solo spec habría tocado esquema, RLS, cliente de servidor, 6 archivos de UI y el flujo de guardado a la vez.

`components/Home.tsx` y `components/LibraryScreen.tsx` ya reciben `games` por props desde sus páginas server; solo `components/HallOfFame.tsx` importa `GAMES` directo. La migración del catálogo toca por tanto 6 archivos, no las 8 pantallas que parecía a primera vista.

---

## Scope

**In:**

- Migración `supabase/migrations/0001_games_scores.sql`: tablas `games` y `scores` (ver Data model), índices, CHECK constraints, RLS activado en ambas con política de `SELECT` pública (rol `anon`) y política de `INSERT` pública en `scores` (la usará SPEC 06; se crea aquí junto con el resto del esquema para no repartir el DDL de una misma tabla en dos specs).
- Migración `supabase/migrations/0002_seed_games.sql`: los 8 juegos actuales de `lib/games.ts`, con `sort_order` igual a su posición actual en el array (preserva el orden de la biblioteca y el `GAMES.slice(0, 6)` del home).
- Migración `supabase/migrations/0003_seed_scores.sql`: 12 filas por juego (96 en total) generadas ejecutando `seededScores()` con las mismas semillas que usa hoy la UI (`id.length * 17 + 3` para la ficha de cada juego, `tab.length * 23 + 7` para el salón — se usa la semilla de la ficha por ser la de mayor granularidad), volcadas a `INSERT` literales.
- Vista `game_stats` (`game_id`, `best` = `MAX(score)`, `plays` = `COUNT(*)` por juego) con `SELECT` público, para alimentar la tira de stats de la ficha sin mantener columnas desincronizadas.
- `supabase/migrations/` como carpeta versionada en el repo; cada migración se aplica también al proyecto remoto (`grgkpgfilsyoxkniyzce`) con `apply_migration` del MCP de Supabase.
- `lib/supabase/server.ts`: `createServerClient()` de `@supabase/ssr`, usando `cookies()` de `next/headers` (async en Next.js 16 — confirmar contra `node_modules/next/dist/docs/` antes de escribirlo). Solo lectura en este spec; no hay sesión de Supabase que gestionar todavía.
- `lib/games.ts`: se eliminan `GAMES` y `getGame`. Se conservan los tipos (`Game`, `GameCategory`, `GameColor`, `ScoreRow`), `CATS` y `seededScores`/`PLAYERS` (SPEC 06 los elimina cuando ya nadie los use).
- `lib/queries.ts` (nuevo): `getGames(): Promise<Game[]>`, `getGameById(id: string): Promise<Game | undefined>`, `getGameIds(): Promise<string[]>`, todas usando el cliente de servidor y ordenando por `sort_order`.
- `app/page.tsx`, `app/biblioteca/page.tsx`, `app/juegos/[id]/page.tsx`, `app/jugar/[id]/page.tsx` pasan a `async` y consumen `lib/queries.ts` en vez de importar `GAMES`/`getGame`; `generateStaticParams` de las rutas dinámicas usa `getGameIds()`.
- `app/salon/page.tsx` se vuelve server component: obtiene los juegos con `getGames()` y los pasa a `HallOfFame` por la nueva prop `games: Game[]`, igual patrón que ya usan `Home` y `LibraryScreen`. `components/HallOfFame.tsx` deja de importar `GAMES` de `lib/games.ts`.
- La tira "Mejor global"/"Partidas" de `app/juegos/[id]/page.tsx` pasa a leer de `game_stats` en vez del `game.best`/`game.plays` estático.
- `database.types.ts` generado con `generate_typescript_types` del MCP (SPEC 03 lo aplazó porque la base estaba vacía; ahora hay algo que tipar) y usado como tipo de retorno interno en `lib/queries.ts`.

**Out of scope (for future specs):**

- Que `/salon` y `/juegos/[id]` lean puntuaciones reales de `scores` — siguen mostrando `seededScores()` al terminar este spec; SPEC 06 hace el cambio.
- Que `PlayerScreen` inserte puntuaciones en `scores` — `saveScore` sigue escribiendo `av_scores` en `localStorage` exactamente igual que hoy.
- Autenticación de cualquier tipo. La columna `user_id` de `scores` queda `nullable` y sin foreign key a `auth.users` — se rellena en el spec que implemente auth.
- Panel de administración de juegos (alta/baja/edición desde la UI) — la única forma de modificar `games` en este spec es por migración SQL.
- Cliente de servidor con capacidad de escritura/sesión (`setAll`/`getAll` de cookies para refrescar tokens) — no hay auth todavía que lo necesite; se añade cuando exista.
- Tests automatizados (no hay test runner configurado en `package.json`).

---

## Data model

```sql
create table games (
  id           text primary key,          -- "asteroides", "bloque-buster", …
  title        text not null,
  short        text not null,
  long         text not null,
  cat          text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover        text not null,              -- clase CSS de portada, p.ej. "cover-rocas"
  color        text not null check (color in ('cyan','magenta','yellow','green')),
  sort_order   int  not null,
  created_at   timestamptz not null default now()
);

create table scores (
  id           uuid primary key default gen_random_uuid(),
  game_id      text not null references games(id) on delete cascade,
  player_name  text not null check (char_length(player_name) between 1 and 10),
  score        int  not null check (score >= 0 and score <= 10000000),
  user_id      uuid,                       -- null hasta que exista auth; sin FK todavía
  created_at   timestamptz not null default now()
);

create index scores_game_score_idx on scores (game_id, score desc);

create view game_stats as
  select game_id, max(score) as best, count(*) as plays
  from scores
  group by game_id;
```

RLS: `alter table games enable row level security;` y `alter table scores enable row level security;`, con una política `select` para `anon`/`authenticated` en ambas y una política `insert` para `anon`/`authenticated` en `scores` (sin política de `update`/`delete`: nadie puede modificar ni borrar puntuaciones desde el cliente).

`best` y `plays` **no** son columnas de `games`: viven solo en la vista `game_stats`, derivados de `scores`, para no mantener dos fuentes de verdad desincronizadas.

`lib/queries.ts` expone el mismo tipo `Game` ya existente en `lib/games.ts`; no se introduce un tipo nuevo para el catálogo.

---

## Implementation plan

1. Escribir `supabase/migrations/0001_games_scores.sql` (tablas, índices, CHECK constraints, vista `game_stats`, RLS) y aplicarla con `apply_migration` del MCP. Verificación: `list_tables` devuelve `games` y `scores` con RLS activado; `list_migrations` lista la migración.
2. Escribir y aplicar `supabase/migrations/0002_seed_games.sql` con los 8 juegos de `lib/games.ts` tal cual (mismos `id`, `title`, `short`, `long`, `cat`, `cover`, `color`) más `sort_order` 0–7. Verificación: `execute_sql` con `select count(*) from games` devuelve 8, y `select id, sort_order from games order by sort_order` respeta el orden actual del array.
3. Escribir y aplicar `supabase/migrations/0003_seed_scores.sql` con 96 filas de `scores` (12 por juego) generadas a partir de `seededScores(id.length * 17 + 3, 12)` por cada `id`. Verificación: `select count(*) from scores` = 96; `select count(*) from scores where game_id = 'asteroides'` = 12.
4. Crear `lib/supabase/server.ts` con `createServerClient()`. Verificación: un script o ruta temporal que llame `(await createClient()).from('games').select('count')` sin lanzar error.
5. Crear `lib/queries.ts` con `getGames`, `getGameById`, `getGameIds`. Verificación: invocarlas desde una página temporal y confirmar que devuelven los 8 juegos en el orden esperado.
6. Migrar `app/page.tsx`, `app/biblioteca/page.tsx` a `async` + `getGames()`. Verificación manual: `/` y `/biblioteca` siguen mostrando los 8 juegos, mismo orden, sin errores de consola.
7. Migrar `app/juegos/[id]/page.tsx` y `app/jugar/[id]/page.tsx`: `generateStaticParams` vía `getGameIds()`, `getGameById(id)` + `notFound()` si no existe; la tira de stats de la ficha lee `game_stats` para `best`/`plays`. Verificación: `/juegos/asteroides` muestra el juego con stats derivados de `scores`; `/juegos/id-inexistente` sigue dando la 404 arcade.
8. Migrar `app/salon/page.tsx` a server component que obtiene `getGames()` y los pasa a `<HallOfFame games={games} />`; editar `HallOfFame.tsx` para recibir `games` por prop en vez de importar `GAMES`. Verificación: `/salon` sigue mostrando las pestañas de los 8 juegos.
9. Eliminar `GAMES` y `getGame` de `lib/games.ts`; correr `grep` para confirmar que no queda ningún import de esos dos símbolos. Verificación: `npm run build` sin errores de tipos.
10. Generar `database.types.ts` con `generate_typescript_types` del MCP. Verificación: el archivo existe y compila con el resto del proyecto.
11. Pasada final: `npm run lint`, `npm run build`, y recorrido manual en el navegador de `/`, `/biblioteca`, `/juegos/asteroides`, `/jugar/asteroides`, `/salon`, `/juegos/id-inexistente` confirmando ausencia de errores de consola.

---

## Acceptance criteria

- [x] `list_tables` (MCP) devuelve `games` y `scores`, ambas con `rls_enabled: true`.
- [x] `select count(*) from games` devuelve 8; `select count(*) from scores` devuelve 96 (12 por juego).
- [x] La vista `game_stats` devuelve una fila por juego con `best` y `plays` coherentes con las filas sembradas de `scores`.
- [x] `lib/games.ts` ya no exporta `GAMES` ni `getGame`; ningún archivo del repo los importa (`grep -r "GAMES\b" --include=*.tsx` sin resultados fuera de comentarios/otros identificadores como `CATS`).
- [x] `/` y `/biblioteca` muestran los 8 juegos en el mismo orden que antes de este spec.
- [x] `/juegos/asteroides` muestra "Mejor global" y "Partidas" derivados de `game_stats`, no valores fijos.
- [x] `/juegos/id-inexistente` y `/jugar/id-inexistente` siguen mostrando la pantalla 404 arcade.
- [x] `/salon` sigue mostrando las pestañas de los 8 juegos y el podio/tabla (todavía con `seededScores`, sin cambios de comportamiento respecto a hoy).
- [x] Con `NEXT_PUBLIC_SUPABASE_URL` o la clave publishable inválidas, `npm run build` falla con un error explícito de conexión (confirma que el catálogo depende realmente de la BD, no de un array residual).
- [x] `database.types.ts` existe en el repo y el proyecto compila usándolo.
- [x] `npm run lint` y `npm run build` terminan sin errores.
- [x] `PlayerScreen`, `SessionProvider` y el guardado de puntuaciones en `localStorage` (`av_scores`) siguen funcionando exactamente igual que antes de este spec.

---

## Decisions

- **Sí:** partir el trabajo en SPEC 05 (esquema + catálogo) y SPEC 06 (leaderboard real). Cada uno queda verificable por sí solo; un spec único habría mezclado DDL, RLS, cliente de servidor, migración de 6 archivos de UI y el flujo de guardado.
- **No:** un spec único con todo junto — descartado por el motivo anterior.
- **No:** partir por capa (backend puro vs. UI pura) en vez de por catálogo vs. leaderboard — descartado porque el catálogo (`games`) y el leaderboard (`scores`) son conceptualmente distintos y cada mitad ya deja el sistema funcional y verificable de punta a punta.
- **Sí:** `games` es la fuente de verdad y `lib/games.ts` pierde `GAMES`/`getGame`. Mantener el array como "solo para FK" habría dejado dos fuentes de datos del catálogo desincronizables sin necesidad.
- **No:** crear `games` únicamente como tabla de referencia para la FK de `scores`, dejando la UI leyendo el array — descartado por la razón anterior.
- **Sí:** lectura desde Server Components con un cliente de servidor nuevo (`lib/supabase/server.ts`). Da datos prerenderizados sin flash de carga y no expone las queries del catálogo al navegador; SPEC 03 ya dejó el cliente de browser para lo que sí necesite ejecutarse en cliente (SPEC 06).
- **No:** leer desde el cliente de browser con `useEffect` en cada componente — descartado por dejar un estado de carga visible en pantallas que hoy son instantáneas (prerenderizadas).
- **Sí:** `best`/`plays` derivados de `scores` vía la vista `game_stats`, no columnas estáticas en `games`. Con columnas estáticas, la ficha seguiría mostrando números que no cuadran con el leaderboard real de SPEC 06.
- **No:** mantener `best`/`plays` como columnas migradas tal cual desde el array — descartado por la razón anterior.
- **Sí:** `scores` se siembra con 96 filas generadas por `seededScores` en vez de arrancar vacía. El Salón y las fichas no cambian de aspecto al terminar este spec (siguen usando `seededScores()` en el render hasta SPEC 06); sembrar la tabla evita definir estados vacíos en un spec que todavía no lee de `scores` desde la UI.
- **No:** `scores` vacía desde el inicio — descartada porque este spec no conecta la UI a `scores` todavía; los estados vacíos son responsabilidad de SPEC 06, que sí lee de la tabla.
- **Sí:** migraciones como archivos SQL versionados en `supabase/migrations/` y aplicadas también con `apply_migration` del MCP. Da historial revisable en git y ejecución reproducible sin depender de que alguien recuerde el SQL exacto.
- **No:** aplicar cambios solo por MCP sin archivos en el repo — descartado porque perdería el historial en git.
- **No:** Supabase CLI local con Docker — descartado por añadir una dependencia de infraestructura (Docker) que el proyecto no tiene y que MCP + SQL versionado ya resuelve sin ella.
- **Sí:** INSERT anónimo (rol `anon`) en `scores`, protegido solo por CHECK constraints (`score` en rango, `player_name` de 1–10 caracteres, `game_id` con FK válida). Es la única opción que funciona hoy sin auth; se documenta como riesgo aceptado, no como solución definitiva.
- **No:** insertar vía Route Handler con `service_role` — descartado por requerir la clave secreta en `.env.local` y no aportar ninguna defensa real sin auth para distinguir usuarios (el Route Handler igual aceptaría cualquier request).
- **No:** no permitir escritura todavía (dejar `scores` de solo lectura) — descartado porque la política de INSERT es DDL del mismo esquema; crearla en SPEC 05 evita reabrir la tabla en SPEC 06 solo para añadir una política.
- **Sí:** `user_id uuid` nullable sin FK en `scores`, en vez de omitir la columna. Cuando exista auth, se empieza a rellenar sin migrar filas existentes.
- **No:** omitir `user_id` hasta que exista auth — descartado por el motivo anterior.
- **No:** mantener `app/api/supabase-health/route.ts` como artefacto de un solo uso sin decidir su destino — se conserva sin cambios; ahora que hay tablas reales sigue siendo un healthcheck válido y barato de mantener.

---

## Risks

| Risk                                                                                                                                                                      | Mitigation                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generateStaticParams` de `/juegos/[id]` y `/jugar/[id]` ahora consulta la BD en tiempo de build; sin `NEXT_PUBLIC_SUPABASE_URL`/clave publishable válidas el build falla | Aceptado y buscado (ver criterio de aceptación de build con clave inválida); documentar la dependencia en el README si hace falta correr un build en CI.                |
| `game_id references games(id) on delete cascade` borra las puntuaciones de un juego si se borra el juego                                                                  | Aceptado: no hay UI de borrado de juegos en este spec; si se necesita en el futuro, ese spec decide si conserva el cascade o lo cambia a `restrict`.                    |
| El `id` textual de `games` sigue siendo la clave primaria y el segmento de la URL a la vez (mismo acoplamiento que ya existía con el array)                               | Aceptado, mismo criterio que SPEC 04 (`rocas` → `asteroides`): renombrar un `id` rompe URLs existentes; no hay usuarios externos todavía.                               |
| Sembrar `scores` con `seededScores()` fija datos que SPEC 06 tendrá que convivir con puntuaciones reales insertadas después                                               | Aceptado: son datos de relleno claramente ficticios (mismos nombres `PX_KAI`/`NEONFOX` que ya usa el mock), coherente con el resto del MVP hasta que haya tráfico real. |

---

## What is **not** in this spec

- Lectura de puntuaciones reales en `/salon` y `/juegos/[id]` (siguen con `seededScores()`).
- Escritura de puntuaciones desde `PlayerScreen` (sigue en `localStorage`).
- Autenticación de cualquier tipo.
- Panel de administración de juegos.
- Cliente de servidor con gestión de sesión/cookies de escritura.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.

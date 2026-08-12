# SPEC 03 — Integración de Supabase (solo infraestructura)

> **Status:** Implementado
> **Depends on:** —
> **Date:** 2026-08-12
> **Objective:** Dejar Supabase instalado y configurado en el proyecto (dependencias, cliente de browser, variables de entorno) con una forma de verificar que la conexión al proyecto funciona, sin autenticación ni tablas.

---

## Por qué este spec

El proyecto Supabase (`grgkpgfilsyoxkniyzce`) ya está conectado por MCP pero vacío, sin ninguna tabla ni cliente instalado en el repo. "Implementar Supabase" toca varias áreas (auth, persistencia de puntuaciones, datos de juegos, infraestructura); este spec cubre solo la infraestructura base. Auth, tablas y cualquier dato real quedan para specs futuros.

---

## Scope

**In:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr`.
- `lib/supabase/client.ts` exportando `createClient()`, que envuelve `createBrowserClient(url, publishableKey)` de `@supabase/ssr` — solo cliente de browser, sin cliente de servidor ni `middleware.ts`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` (valores reales del proyecto `grgkpgfilsyoxkniyzce`) y `.env.template` (placeholders `xxxxx`, mismo estilo que las entradas existentes).
- `app/api/supabase-health/route.ts`: Route Handler que hace `fetch` a `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health` con el header `apikey` y devuelve `{ ok, status }` en JSON. Sirve como criterio de aceptación verificable de que las credenciales realmente alcanzan el proyecto.

**Out of scope (for future specs):**

- Autenticación de cualquier tipo (email + contraseña, anónima, OAuth). `AuthScreen` y `SessionProvider` siguen mock, con `av_user` en `localStorage`.
- Cualquier tabla en la base de datos, incluida `scores`; `av_scores` sigue en `localStorage`.
- Migrar `GAMES` de `lib/games.ts` a la base de datos.
- Cliente de servidor (`createServerClient`) y `middleware.ts`.
- Generación de tipos TypeScript de la base (`database.types.ts`) — la base está vacía, no hay nada que tipar todavía.
- Cambios de configuración en el dashboard de Supabase (incluida la confirmación de email para auth).
- Tests automatizados (no hay test runner configurado en `package.json`).

---

## Data model

Este spec no introduce estructuras de datos nuevas ni tablas. La base de datos del proyecto Supabase sigue vacía al terminar este spec.

---

## Implementation plan

1. Instalar `@supabase/supabase-js` y `@supabase/ssr` (`npm install`). Verificar que `npm run build` sigue pasando.
2. Agregar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a `.env.local` (valores reales del proyecto `grgkpgfilsyoxkniyzce`) y a `.env.template` (placeholders `xxxxx`).
3. Crear `lib/supabase/client.ts` con `createClient()`, que lanza un error explícito si falta alguna de las dos variables de entorno.
4. Crear `app/api/supabase-health/route.ts`.
5. Pasada final: `npm run lint`, `npm run build`, y `curl http://localhost:3000/api/supabase-health` devolviendo `{"ok":true}`.

---

## Acceptance criteria

- [x] `package.json` lista `@supabase/supabase-js` y `@supabase/ssr`.
- [x] `.env.local` y `.env.template` incluyen `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (la template con placeholders).
- [x] `lib/supabase/client.ts` existe y exporta `createClient()`.
- [x] Con el dev server corriendo, `GET /api/supabase-health` devuelve HTTP 200 con `{"ok":true}`.
- [x] Con una clave inválida, la misma ruta devuelve `ok:false` (confirma que la ruta realmente consulta al proyecto y no responde `ok` sin verificar).
- [x] `npm run lint` y `npm run build` terminan sin errores.
- [x] `AuthScreen`, `SessionProvider`, `Nav`, `HallOfFame` y `PlayerScreen` no cambian: login mock, invitado y guardado de puntuaciones en `localStorage` se comportan igual que antes de este spec.
- [x] El esquema `public` del proyecto Supabase sigue sin tablas nuevas.

---

## Decisions

- **Sí:** alcance recortado a solo infraestructura (dependencias, cliente de browser, env vars, healthcheck). Auth y tablas se descartaron explícitamente para este spec; van en specs futuros separados.
- **Sí:** cliente solo-browser (`createBrowserClient`), sin cliente de servidor ni `middleware.ts`. No hay nada en el proyecto (auth, rutas protegidas) que los necesite todavía; agregarlos ahora sería código sin uso.
- **Sí:** ruta de healthcheck (`app/api/supabase-health/route.ts`) como criterio de verificación. Sin auth ni tablas no hay funcionalidad visible que probar en la UI; la ruta da un criterio booleano real ("la conexión al proyecto funciona") en vez de conformarse con "compila".
- **No:** generar `database.types.ts`. La base está vacía, así que los tipos generados estarían vacíos y no aportarían nada; se genera en el spec que cree la primera tabla.
- **No:** desactivar la confirmación de email u otro cambio de configuración del dashboard. No aplica sin auth en este spec.

---

## Risks

| Risk                                                                                                           | Mitigation                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| La clave publishable queda commiteada                                                                          | `.gitignore` ya ignora `.env*` salvo `.env.template`; la clave real solo va a `.env.local`.                                             |
| `lib/supabase/client.ts` queda sin ejercitarse en runtime (el healthcheck no lo usa, es un cliente de browser) | Aceptado: nada del UI lo consume todavía. Lo cubren `lint`/`build`/tipos; su primer uso real llega en el spec que agregue auth o datos. |
| La ruta de healthcheck queda como código "de un solo uso" tras verificar el spec                               | Documentado: es un artefacto de verificación de este spec. El spec que agregue auth o datos decide si se borra o se reutiliza.          |

---

## What is **not** in this spec

- Autenticación (email + contraseña, anónima, OAuth).
- Cualquier tabla en la base de datos, incluida `scores`.
- Migración de `GAMES` a la base de datos.
- Cliente de servidor y `middleware.ts`.
- Generación de tipos TypeScript de la base.
- Cambios de configuración en el dashboard de Supabase.

Cada uno de estos, si se implementa, va en su propio spec.

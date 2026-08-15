## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

Catálogo de 8 juegos con leaderboard real en Supabase; 2 son ya jugables de verdad (`asteroides`, `caida`), el resto usa un arena mock hasta que se les asigna un spec. Ver `references/implemented-games.md` para el estado exacto.

## Usa Spec Driven Design

Basado en `/spec` y `/spec-impl`, instalados en el repo (`.claude/skills/`, fijados por `skills-lock.json`).

Siguiendo las buenas prácticas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```

- `spec` / `spec-impl` — flujo de spec-driven development (`Klerith/fernando-skills`)
- `frontend-design` — diseño de UI
- `add-game` (local) — escribe el spec para conectar un juego jugable real + su leaderboard

## Agentes

- `game-planner` (`.claude/agents/game-planner.md`) — decide qué juego implementar a continuación (analiza catálogo, DB y fuentes portables en `references/started-games/`, mantiene memoria de rondas en `references/game-suggestions.md`). Su salida se entrega a `/add-game`.

## Commands

```bash
npm run dev      # start dev server (Next.js, Turbopack by default)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint (flat config, eslint.config.mjs)
npm run lint:fix # eslint --fix
npm run format   # prettier --write .
```

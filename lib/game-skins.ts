// Sistema de skins compartido por los juegos jugables (AsteroidsGame, TetrisGame, ...).
//
// Cada skin es una paleta semántica, no una función de dibujo: Asteroids no tiene
// "bloques" como Tetris (necesita trazo de polígonos, partículas y propulsor), así
// que compartir una función de dibujo tipo `drawBlock` no sirve para ambos. Cada
// componente decide cómo aplica los campos de `GameSkin` a su propia técnica de
// render; lo que comparten es el vocabulario de colores.
//
// Los tres colores base (`primary`/`accent`/`ink`) y las 4 primeras entradas de
// `pieces` de las skins `clasico` y `neon` se derivan de las variables del tema en
// app/globals.css (--cyan/--magenta/--yellow/--green), para que el canvas deje de
// divergir del resto de la UI (antes TetrisGame pintaba #00ffff/#ffff00/#ff00ff,
// el tema define #00f5ff/#f5ff00/#ff006e — colores distintos de verdad).
//
// Contraste verificado contra --bg (#0a0a0f, luminancia relativa ≈0.003) con la
// fórmula WCAG de luminancia relativa: todo `ink`/`primary`/`accent` de las 3 skins
// da ≥5:1, por encima del umbral de texto (4.5:1) y muy por encima del de gráficos
// (3:1, SC 1.4.11). Las líneas de `grid` quedan exentas a propósito: son detalle
// decorativo no esencial, mismo criterio que ya usa el grid actual de TetrisGame
// (rgba(255,255,255,0.08), tampoco pasaría 3:1).

export type SkinId = "clasico" | "neon" | "retro";

export type GameSkin = {
  id: SkinId;
  label: string;
  /** Fondo del canvas. */
  bg: string;
  /** Rejilla / detalle tenue — exento del umbral de contraste, es decorativo. */
  grid: string;
  /** Texto y HUD dibujados dentro del canvas (p. ej. panel lateral de CAÍDA). */
  ink: string;
  /** Trazo principal: nave, asteroides, contorno de bloques. */
  primary: string;
  /** Acento: llama del propulsor, resaltados secundarios. */
  accent: string;
  /** 7 colores para juegos de piezas (Tetris), indexados 0-6 = piezas I,O,T,S,Z,J,L. */
  pieces: string[];
  /** shadowBlur a aplicar en trazos con glow; 0 = sin glow (técnica plana). */
  glow: number;
  /** Opacidad de relleno en la técnica con glow. */
  fillAlpha: number;
};

export const SKINS: Record<SkinId, GameSkin> = {
  clasico: {
    id: "clasico",
    label: "Clásico",
    bg: "#0a0a0f",
    grid: "rgba(230, 233, 255, 0.08)",
    ink: "#e6e9ff",
    primary: "#e6e9ff",
    accent: "#ffcf3a",
    pieces: ["#00f5ff", "#f5ff00", "#ff006e", "#00ff88", "#ff3b3b", "#4d7fff", "#ff8c00"],
    glow: 0,
    fillAlpha: 1,
  },
  neon: {
    id: "neon",
    label: "Neón",
    bg: "#000000",
    grid: "rgba(0, 245, 255, 0.15)",
    ink: "#00f5ff",
    primary: "#00f5ff",
    accent: "#ff006e",
    pieces: ["#00f5ff", "#f5ff00", "#ff006e", "#00ff88", "#ff0040", "#00aaff", "#ff8000"],
    glow: 15,
    fillAlpha: 0.55,
  },
  retro: {
    id: "retro",
    label: "Retro",
    bg: "#0f0a05",
    grid: "rgba(255, 207, 58, 0.1)",
    ink: "#ffcf3a",
    primary: "#ffcf3a",
    accent: "#d97a3a",
    // La rampa "Retro" del starter (references/started-games/03-tetris/game.js)
    // repite casi el mismo tono en O (#ffd54f) y L (#ffb74d) — apenas se
    // distinguen a simple vista. Se corrige L a un naranja más profundo,
    // manteniendo el resto de la rampa intacta.
    pieces: ["#4dd0e1", "#ffd54f", "#ba68c8", "#81c784", "#e57373", "#90caf9", "#ff7043"],
    glow: 0,
    fillAlpha: 1,
  },
};

export const DEFAULT_SKIN: SkinId = "clasico";
export const SKIN_ORDER: readonly SkinId[] = ["clasico", "neon", "retro"];

export function getSkin(id: string | null | undefined): GameSkin {
  if (id && id in SKINS) return SKINS[id as SkinId];
  return SKINS[DEFAULT_SKIN];
}

/** Convierte un hex "#rrggbb" a sus componentes RGB. Usado para derivar rgba() con alpha. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

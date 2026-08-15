// Layouts de la botonera táctil para /jugar. Los `code` coinciden 1:1 con los
// `KeyboardEvent.code` que ya consumen AsteroidsGame y TetrisGame, así que
// teclado y táctil terminan en la misma ruta de código dentro de cada juego.

export type TouchButton = {
  code: string;
  glyph: string;
  aria: string;
  /** Cluster del pulgar en el layout vertical: movimiento a la izquierda, acción a la derecha. */
  side: "left" | "right";
};

export const TOUCH_LAYOUTS: Record<string, TouchButton[]> = {
  asteroides: [
    { code: "ArrowLeft", glyph: "◀", aria: "Girar a la izquierda", side: "left" },
    { code: "ArrowRight", glyph: "▶", aria: "Girar a la derecha", side: "left" },
    { code: "ArrowUp", glyph: "▲", aria: "Propulsar", side: "right" },
    { code: "Space", glyph: "●", aria: "Disparar", side: "right" },
  ],
  caida: [
    { code: "ArrowLeft", glyph: "◀", aria: "Mover a la izquierda", side: "left" },
    { code: "ArrowRight", glyph: "▶", aria: "Mover a la derecha", side: "left" },
    { code: "ArrowDown", glyph: "▼", aria: "Bajar", side: "left" },
    { code: "ArrowUp", glyph: "⟳", aria: "Rotar", side: "right" },
    { code: "Space", glyph: "⬇", aria: "Caída rápida", side: "right" },
  ],
};

export function getTouchLayout(gameId: string): TouchButton[] | null {
  return TOUCH_LAYOUTS[gameId] ?? null;
}

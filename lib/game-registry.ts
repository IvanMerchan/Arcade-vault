import type { RefObject } from "react";
import type { GameSkin } from "@/lib/game-skins";

export type GameStats = { score: number; lives: number; level: number };

/** Handle que cada juego jugable instala en `touchInputRef.current` para recibir input táctil. */
export type TouchInputHandle = {
  press: (code: string) => void;
  release: (code: string) => void;
};

export type PlayableGameProps = {
  running: boolean;
  onStats: (stats: GameStats) => void;
  onGameOver: (finalScore: number) => void;
  skin: GameSkin;
  touchInputRef: RefObject<TouchInputHandle | null>;
};

const PLAYABLE_GAME_IDS = new Set(["asteroides", "caida", "frogger"]);

export function isPlayable(id: string): boolean {
  return PLAYABLE_GAME_IDS.has(id);
}

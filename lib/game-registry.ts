export type GameStats = { score: number; lives: number; level: number };

export type PlayableGameProps = {
  running: boolean;
  onStats: (stats: GameStats) => void;
  onGameOver: (finalScore: number) => void;
};

const PLAYABLE_GAME_IDS = new Set(["asteroides", "caida"]);

export function isPlayable(id: string): boolean {
  return PLAYABLE_GAME_IDS.has(id);
}

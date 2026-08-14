"use client";

import { useEffect, useRef } from "react";
import type { GameStats, PlayableGameProps } from "@/lib/game-registry";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const W = 800;
const H = 600;
const BOARD_X = (W - COLS * BLOCK) / 2;
const BOARD_Y = 0;

const LINE_SCORES = [0, 100, 300, 500, 800];
const WALL_KICKS = [0, -1, 1, -2, 2];

// Skin Neon del original (references/started-games/03-tetris/game.js), fija — sin selector.
const COLORS = [
  null,
  "#00ffff", // I - cyan
  "#ffff00", // O - yellow
  "#ff00ff", // T - magenta
  "#00ff00", // S - green
  "#ff0040", // Z - red
  "#00aaff", // J - blue
  "#ff8000", // L - orange
] as const;

type PieceShape = number[][];

// Las 7 piezas estándar. El original trae una 8ª pieza "N" (tuerca, gris, 3×3
// hueca) que ninguna documentación del proyecto fuente menciona — se excluye
// a propósito (ver SPEC 07, Decisions).
const PIECES: (PieceShape | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
];

type Piece = { type: number; shape: PieceShape; x: number; y: number };

type TetrisState = {
  board: number[][];
  current: Piece;
  next: Piece;
  score: number;
  lines: number;
  level: number;
  dropAccum: number;
  dropInterval: number;
  currentCombo: number;
  maxCombo: number;
  lastClearWasCombo: boolean;
  gameOver: boolean;
  gameOverNotified: boolean;
  lastTime: number | null;
};

function createBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function collide(board: number[][], shape: PieceShape, ox: number, oy: number): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape: PieceShape): PieceShape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: PieceShape = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][rows - 1 - r] = shape[r][c];
    }
  }
  return result;
}

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = (PIECES[type] as PieceShape).map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

function createInitialState(): TetrisState {
  const current = randomPiece();
  const next = randomPiece();
  return {
    board: createBoard(),
    current,
    next,
    score: 0,
    lines: 0,
    level: 1,
    dropAccum: 0,
    dropInterval: 1000,
    currentCombo: 0,
    maxCombo: 0,
    lastClearWasCombo: false,
    gameOver: false,
    gameOverNotified: false,
    lastTime: null,
  };
}

function ghostY(state: TetrisState): number {
  let gy = state.current.y;
  while (!collide(state.board, state.current.shape, state.current.x, gy + 1)) gy++;
  return gy;
}

function merge(state: TetrisState) {
  const { shape, x, y } = state.current;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) state.board[y + r][x + c] = shape[r][c];
    }
  }
}

function clearLines(state: TetrisState) {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (state.board[r].every((v) => v !== 0)) {
      state.board.splice(r, 1);
      state.board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    state.lines += cleared;
    state.score += (LINE_SCORES[cleared] ?? 0) * state.level;
    state.level = Math.floor(state.lines / 10) + 1;
    state.dropInterval = Math.max(100, 1000 - (state.level - 1) * 90);
    state.currentCombo = state.lastClearWasCombo ? state.currentCombo + 1 : 1;
    state.lastClearWasCombo = true;
    if (state.currentCombo > state.maxCombo) state.maxCombo = state.currentCombo;
  } else {
    state.lastClearWasCombo = false;
  }
}

function spawn(state: TetrisState) {
  state.current = state.next;
  state.next = randomPiece();
  if (collide(state.board, state.current.shape, state.current.x, state.current.y)) {
    state.gameOver = true;
  }
}

function lockPiece(state: TetrisState) {
  merge(state);
  clearLines(state);
  spawn(state);
}

function softDrop(state: TetrisState) {
  if (!collide(state.board, state.current.shape, state.current.x, state.current.y + 1)) {
    state.current.y++;
    state.score += 1;
  } else {
    lockPiece(state);
  }
}

function hardDrop(state: TetrisState) {
  const gy = ghostY(state);
  state.score += (gy - state.current.y) * 2;
  state.current.y = gy;
  lockPiece(state);
}

function tryRotate(state: TetrisState) {
  const rotated = rotateCW(state.current.shape);
  for (const kick of WALL_KICKS) {
    if (!collide(state.board, rotated, state.current.x + kick, state.current.y)) {
      state.current.shape = rotated;
      state.current.x += kick;
      return;
    }
  }
}

function update(state: TetrisState, dt: number) {
  if (state.gameOver) return;
  state.dropAccum += dt;
  if (state.dropAccum >= state.dropInterval) {
    state.dropAccum = 0;
    if (!collide(state.board, state.current.shape, state.current.x, state.current.y + 1)) {
      state.current.y++;
    } else {
      lockPiece(state);
    }
  }
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  cellX: number,
  cellY: number,
  colorIndex: number,
  size: number,
  alpha = 1,
) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  if (!color) return;
  const px = offsetX + cellX * size;
  const py = offsetY + cellY * size;
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = alpha < 0.5 ? 8 : 15;
  ctx.shadowColor = color;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px + 1.75, py + 1.75, size - 3.5, size - 3.5);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(BOARD_X + c * BLOCK, BOARD_Y);
    ctx.lineTo(BOARD_X + c * BLOCK, BOARD_Y + ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(BOARD_X, BOARD_Y + r * BLOCK);
    ctx.lineTo(BOARD_X + COLS * BLOCK, BOARD_Y + r * BLOCK);
    ctx.stroke();
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, board: number[][]) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const value = board[r][c];
      if (value) drawBlock(ctx, BOARD_X, BOARD_Y, c, r, value, BLOCK);
    }
  }
}

function drawSidePanels(ctx: CanvasRenderingContext2D, state: TetrisState) {
  const leftCenterX = BOARD_X / 2;
  const panelX = BOARD_X + COLS * BLOCK;
  const panelW = W - panelX;
  const rightCenterX = panelX + panelW / 2;

  ctx.textAlign = "center";
  ctx.fillStyle = "#00ffff";
  ctx.shadowColor = "#00ffff";
  ctx.shadowBlur = 6;

  ctx.font = "bold 13px monospace";
  ctx.fillText("LÍNEAS", leftCenterX, 40);
  ctx.font = "bold 26px monospace";
  ctx.fillText(String(state.lines), leftCenterX, 74);

  ctx.font = "bold 13px monospace";
  ctx.fillText("COMBO", leftCenterX, 140);
  ctx.font = "bold 26px monospace";
  ctx.fillText(state.currentCombo > 1 ? `x${state.currentCombo}` : "—", leftCenterX, 174);

  ctx.font = "bold 13px monospace";
  ctx.fillText("SIGUIENTE", rightCenterX, 40);

  const NB = 30;
  const previewShape = state.next.shape;
  const offX = Math.floor((4 - previewShape[0].length) / 2);
  const offY = Math.floor((4 - previewShape.length) / 2);
  const previewX = panelX + (panelW - 4 * NB) / 2;
  const previewY = 60;
  for (let r = 0; r < previewShape.length; r++) {
    for (let c = 0; c < previewShape[r].length; c++) {
      const value = previewShape[r][c];
      if (value) drawBlock(ctx, previewX, previewY, offX + c, offY + r, value, NB);
    }
  }

  ctx.shadowBlur = 0;
}

function draw(ctx: CanvasRenderingContext2D, state: TetrisState) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  drawGrid(ctx);
  drawBoard(ctx, state.board);

  const gy = ghostY(state);
  const { shape, x, y } = state.current;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      const value = shape[r][c];
      if (value) drawBlock(ctx, BOARD_X, BOARD_Y, x + c, gy + r, value, BLOCK, 0.2);
    }
  }
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      const value = shape[r][c];
      if (value) drawBlock(ctx, BOARD_X, BOARD_Y, x + c, y + r, value, BLOCK);
    }
  }

  drawSidePanels(ctx, state);
}

export function TetrisGame({ running, onStats, onGameOver }: PlayableGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TetrisState | null>(null);
  const lastStatsRef = useRef<GameStats>({ score: 0, lives: 1, level: 1 });
  const onStatsRef = useRef(onStats);
  const onGameOverRef = useRef(onGameOver);

  useEffect(() => {
    onStatsRef.current = onStats;
  }, [onStats]);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    gameRef.current = createInitialState();
    lastStatsRef.current = { score: 0, lives: 1, level: 1 };
  }, []);

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    const g = gameRef.current;
    if (!canvas || !g) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function onKeyDown(e: KeyboardEvent) {
      if (g!.gameOver) return;
      switch (e.code) {
        case "ArrowLeft":
          e.preventDefault();
          if (!collide(g!.board, g!.current.shape, g!.current.x - 1, g!.current.y)) g!.current.x--;
          break;
        case "ArrowRight":
          e.preventDefault();
          if (!collide(g!.board, g!.current.shape, g!.current.x + 1, g!.current.y)) g!.current.x++;
          break;
        case "ArrowDown":
          e.preventDefault();
          softDrop(g!);
          break;
        case "ArrowUp":
        case "KeyX":
          e.preventDefault();
          tryRotate(g!);
          break;
        case "Space":
          e.preventDefault();
          hardDrop(g!);
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);

    function reportStats() {
      const next: GameStats = {
        score: g!.score,
        lives: g!.gameOver ? 0 : 1,
        level: g!.level,
      };
      const prev = lastStatsRef.current;
      if (next.score !== prev.score || next.lives !== prev.lives || next.level !== prev.level) {
        lastStatsRef.current = next;
        onStatsRef.current(next);
      }
    }

    let raf = 0;
    function loop(ts: number) {
      const dt = g!.lastTime === null ? 0 : ts - g!.lastTime;
      g!.lastTime = ts;
      update(g!, dt);
      draw(ctx!, g!);
      reportStats();
      if (g!.gameOver && !g!.gameOverNotified) {
        g!.gameOverNotified = true;
        onGameOverRef.current(g!.score);
      }
      raf = requestAnimationFrame(loop);
    }
    g.lastTime = null;
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [running]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
    />
  );
}

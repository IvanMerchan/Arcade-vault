"use client";

import { useEffect, useRef } from "react";
import type { GameStats, PlayableGameProps } from "@/lib/game-registry";
import { hexToRgb, type GameSkin } from "@/lib/game-skins";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const W = 800;
const H = 600;
const BOARD_X = (W - COLS * BLOCK) / 2;
const BOARD_Y = 0;

const LINE_SCORES = [0, 100, 300, 500, 800];
const WALL_KICKS = [0, -1, 1, -2, 2];

// Códigos que el juego reconoce (teclado y táctil comparten el mismo vocabulario).
const HANDLED_CODES = new Set(["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "KeyX", "Space"]);
// Mover a los lados y bajar se repiten mientras se mantienen pulsados (DAS);
// rotar y caída rápida son siempre de un solo disparo por pulsación.
const DAS_CODES = new Set(["ArrowLeft", "ArrowRight", "ArrowDown"]);
const DAS_DELAY = 170; // ms hasta la primera repetición
const DAS_INTERVAL = 50; // ms entre repeticiones siguientes

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
  keys: Record<string, boolean>;
  dasTimer: Record<string, number>;
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
    keys: {},
    dasTimer: {},
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

/** Ejecuta la acción de un `code` una sola vez. Compartida por el disparo inicial (press) y por cada repetición del DAS. */
function applyAction(code: string, state: TetrisState) {
  switch (code) {
    case "ArrowLeft":
      if (!collide(state.board, state.current.shape, state.current.x - 1, state.current.y))
        state.current.x--;
      break;
    case "ArrowRight":
      if (!collide(state.board, state.current.shape, state.current.x + 1, state.current.y))
        state.current.x++;
      break;
    case "ArrowDown":
      softDrop(state);
      break;
    case "ArrowUp":
    case "KeyX":
      tryRotate(state);
      break;
    case "Space":
      hardDrop(state);
      break;
  }
}

/** Instalado como `press`/`release` del contrato táctil; el teclado llama a las mismas funciones. */
function press(state: TetrisState, code: string) {
  if (state.gameOver || state.keys[code]) return;
  state.keys[code] = true;
  if (DAS_CODES.has(code)) state.dasTimer[code] = DAS_DELAY;
  applyAction(code, state);
}

function release(state: TetrisState, code: string) {
  state.keys[code] = false;
  delete state.dasTimer[code];
}

function updateDAS(state: TetrisState, dt: number) {
  for (const code of DAS_CODES) {
    if (!state.keys[code]) continue;
    state.dasTimer[code] -= dt;
    if (state.dasTimer[code] <= 0) {
      state.dasTimer[code] = DAS_INTERVAL;
      applyAction(code, state);
    }
  }
}

function update(state: TetrisState, dt: number) {
  if (state.gameOver) return;
  updateDAS(state, dt);
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

/**
 * Dibuja un bloque con la técnica de la skin activa:
 * - `skin.glow > 0` (neón): shadowBlur + relleno translúcido + strokeRect, igual
 *   que la skin Neon portada en SPEC 07.
 * - `skin.glow === 0` (clásico/retro): relleno plano sin sombra; retro añade
 *   además una banda de highlight superior (bisel falso, look de fósforo CRT).
 */
function drawBlock(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  cellX: number,
  cellY: number,
  colorIndex: number,
  size: number,
  skin: GameSkin,
  alpha = 1,
) {
  if (!colorIndex) return;
  const color = skin.pieces[colorIndex - 1];
  if (!color) return;
  const px = offsetX + cellX * size;
  const py = offsetY + cellY * size;
  const { r, g, b } = hexToRgb(color);

  ctx.globalAlpha = alpha;
  if (skin.glow > 0) {
    ctx.shadowBlur = alpha < 0.5 ? skin.glow * (8 / 15) : skin.glow;
    ctx.shadowColor = color;
    ctx.fillStyle = `rgba(${r},${g},${b},${skin.fillAlpha})`;
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 1.75, py + 1.75, size - 3.5, size - 3.5);
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
    if (skin.id === "retro") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.fillRect(px + 1, py + 1, size - 2, 4);
    }
    ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
  }
  ctx.globalAlpha = 1;
}

function drawGrid(ctx: CanvasRenderingContext2D, skin: GameSkin) {
  ctx.strokeStyle = skin.grid;
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

function drawBoard(ctx: CanvasRenderingContext2D, board: number[][], skin: GameSkin) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const value = board[r][c];
      if (value) drawBlock(ctx, BOARD_X, BOARD_Y, c, r, value, BLOCK, skin);
    }
  }
}

function drawSidePanels(ctx: CanvasRenderingContext2D, state: TetrisState, skin: GameSkin) {
  const leftCenterX = BOARD_X / 2;
  const panelX = BOARD_X + COLS * BLOCK;
  const panelW = W - panelX;
  const rightCenterX = panelX + panelW / 2;

  ctx.textAlign = "center";
  ctx.fillStyle = skin.ink;
  ctx.shadowColor = skin.ink;
  ctx.shadowBlur = skin.glow > 0 ? 6 : 0;

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
      if (value) drawBlock(ctx, previewX, previewY, offX + c, offY + r, value, NB, skin);
    }
  }

  ctx.shadowBlur = 0;
}

function draw(ctx: CanvasRenderingContext2D, state: TetrisState, skin: GameSkin) {
  ctx.fillStyle = skin.bg;
  ctx.fillRect(0, 0, W, H);
  drawGrid(ctx, skin);
  drawBoard(ctx, state.board, skin);

  const gy = ghostY(state);
  const { shape, x, y } = state.current;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      const value = shape[r][c];
      if (value) drawBlock(ctx, BOARD_X, BOARD_Y, x + c, gy + r, value, BLOCK, skin, 0.2);
    }
  }
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      const value = shape[r][c];
      if (value) drawBlock(ctx, BOARD_X, BOARD_Y, x + c, y + r, value, BLOCK, skin);
    }
  }

  drawSidePanels(ctx, state, skin);
}

export function TetrisGame({
  running,
  onStats,
  onGameOver,
  skin,
  touchInputRef,
}: PlayableGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TetrisState | null>(null);
  const lastStatsRef = useRef<GameStats>({ score: 0, lives: 1, level: 1 });
  const onStatsRef = useRef(onStats);
  const onGameOverRef = useRef(onGameOver);
  const skinRef = useRef(skin);

  useEffect(() => {
    onStatsRef.current = onStats;
  }, [onStats]);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  // La skin viaja por ref, no por dependencia del efecto principal: cambiarla no
  // debe reiniciar el loop de requestAnimationFrame ni la partida en curso.
  useEffect(() => {
    skinRef.current = skin;
  }, [skin]);

  useEffect(() => {
    gameRef.current = createInitialState();
    lastStatsRef.current = { score: 0, lives: 1, level: 1 };
  }, []);

  // Si el jugador cambia de skin mientras está en pausa, el loop de rAF no está
  // corriendo para repintar con el frame nuevo — se repinta una vez a mano para
  // que el cambio se vea de inmediato en vez de esperar a reanudar.
  useEffect(() => {
    if (running) return;
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (ctx && g) draw(ctx, g, skin);
  }, [skin, running]);

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    const g = gameRef.current;
    if (!canvas || !g) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function onKeyDown(e: KeyboardEvent) {
      if (g!.gameOver || e.repeat || !HANDLED_CODES.has(e.code)) return;
      e.preventDefault();
      press(g!, e.code);
    }
    function onKeyUp(e: KeyboardEvent) {
      release(g!, e.code);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    touchInputRef.current = {
      press: (code) => press(g!, code),
      release: (code) => release(g!, code),
    };

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
      draw(ctx!, g!, skinRef.current);
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
      window.removeEventListener("keyup", onKeyUp);
      touchInputRef.current = null;
    };
  }, [running, touchInputRef]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
    />
  );
}

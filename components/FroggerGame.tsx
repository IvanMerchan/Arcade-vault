"use client";

import { useEffect, useRef } from "react";
import type { GameStats, PlayableGameProps } from "@/lib/game-registry";
import { hexToRgb, type GameSkin } from "@/lib/game-skins";

// Resolución interna fija de la plataforma (ver CLAUDE.md): 800×600 (4:3, coincide
// con .crt-screen). La grilla de juego (16×14 celdas de 40px = 640×560, según el
// spec) se centra dentro de ese lienzo, igual que TetrisGame centra su tablero
// dentro de 800×600 y usa el margen sobrante para el HUD.
const COLS = 16;
const ROWS = 14;
const CELL = 40; // px
const GRID_W = COLS * CELL; // 640
const GRID_H = ROWS * CELL; // 560
const W = 800;
const H = 600;
const GRID_X = (W - GRID_W) / 2; // 80
const GRID_Y = (H - GRID_H) / 2; // 20

// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

const JUMP_MS = 120;
const ROUND_TIME_S = 15;
const GOAL_WIDTH = 2; // columnas por boca

type Direction = "up" | "down" | "left" | "right";
type EntityType = "car" | "truck" | "log" | "turtle";

interface Entity {
  col: number;
  width: number;
  type: EntityType;
  submerged?: boolean;
  /** Solo tortugas: desfase (ms) del ciclo de inmersión, compartido por las tortugas de un mismo grupo. */
  cyclePhase?: number;
}

interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}

/** Una de las 5 bocas destino de la fila superior. */
interface Goal {
  col: number;
  width: number;
  filled: boolean;
}

const ROAD_TYPES: EntityType[] = ["car", "truck"];
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;
const TURTLE_CYCLE_MS = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;

/** Cada nivel incrementa todas las velocidades un 15% (spec, paso 3). */
function levelSpeedScale(level: number): number {
  return Math.pow(1.15, level - 1);
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Reparte `count` entidades de ancho variable en `count` tramos iguales de la
 * fila (COLS / count celdas cada uno), dejando siempre al menos 1 celda de
 * hueco dentro de cada tramo — así el carril es siempre atravesable.
 */
function placeEntities(
  count: number,
  widthRange: [number, number],
  makeEntity: (col: number, width: number) => Entity,
): Entity[] {
  const period = COLS / count;
  const entities: Entity[] = [];
  for (let i = 0; i < count; i++) {
    const width = Math.floor(randomBetween(widthRange[0], widthRange[1] + 1));
    const maxOffset = Math.max(0, period - width - 1);
    const offset = maxOffset > 0 ? Math.floor(Math.random() * maxOffset) : 0;
    entities.push(makeEntity(i * period + offset, width));
  }
  return entities;
}

function buildRoadLane(row: number, dir: 1 | -1, level: number): Lane {
  const speed = randomBetween(1.5, 4) * levelSpeedScale(level);
  const count = 3 + Math.floor(Math.random() * 2); // 3-4 entidades por carril
  const entities = placeEntities(count, [1, 3], (col, width) => ({
    col,
    width,
    type: ROAD_TYPES[Math.floor(Math.random() * ROAD_TYPES.length)],
  }));
  return { row, speed, dir, entities };
}

function buildLogLane(row: number, dir: 1 | -1, level: number): Lane {
  const speed = randomBetween(1, 3) * levelSpeedScale(level);
  const count = 2 + Math.floor(Math.random() * 2); // 2-3 troncos
  const entities = placeEntities(count, [2, 4], (col, width) => ({
    col,
    width,
    type: "log",
  }));
  return { row, speed, dir, entities };
}

function buildTurtleLane(row: number, dir: 1 | -1, level: number): Lane {
  const speed = randomBetween(1, 3) * levelSpeedScale(level);
  const groupCount = 2;
  const entities = placeEntities(groupCount, [2, 3], (startCol, groupSize) => {
    // placeEntities crea una sola Entity por grupo; se expande abajo a `groupSize`
    // tortugas contiguas que comparten fase de inmersión.
    return { col: startCol, width: groupSize, type: "turtle" };
  }).flatMap((group) => {
    const cyclePhase = Math.floor(Math.random() * TURTLE_CYCLE_MS);
    return Array.from({ length: group.width }, (_, i) => ({
      col: group.col + i,
      width: 1,
      type: "turtle" as const,
      submerged: false,
      cyclePhase,
    }));
  });
  return { row, speed, dir, entities };
}

/** Construye los 5 carriles de carretera y los 6 de río para un nivel dado. */
function buildLanes(level: number): Lane[] {
  const lanes: Lane[] = [];

  const roadRows = Array.from(
    { length: ROW_ROAD_BOT - ROW_ROAD_TOP + 1 },
    (_, i) => ROW_ROAD_TOP + i,
  );
  roadRows.forEach((row, i) => {
    const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
    lanes.push(buildRoadLane(row, dir, level));
  });

  const riverRows = Array.from(
    { length: ROW_RIVER_BOT - ROW_RIVER_TOP + 1 },
    (_, i) => ROW_RIVER_TOP + i,
  );
  riverRows.forEach((row, i) => {
    const dir: 1 | -1 = i % 2 === 0 ? -1 : 1;
    const lane = i % 2 === 0 ? buildLogLane(row, dir, level) : buildTurtleLane(row, dir, level);
    lanes.push(lane);
  });

  return lanes;
}

const GOAL_START_COLS = [1, 4, 7, 10, 13];

const CODE_TO_DIR: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

interface FroggerState {
  lanes: Lane[];
  frog: Frog;
  goals: Goal[];
  lives: number;
  score: number;
  level: number;
  /** Fila más alta (número de fila más bajo) alcanzada esta ronda; da el bonus de avance. */
  minRowReached: number;
  roundTimeMs: number;
  roundTimeMaxMs: number;
  /** Reloj monótono (nunca se reinicia) que gobierna el ciclo de inmersión de las tortugas. */
  clockMs: number;
  pendingDir: Direction | null;
  gameOver: boolean;
  gameOverNotified: boolean;
  lastTime: number | null;
}

function roundTimeForLevel(level: number): number {
  return Math.max(5, ROUND_TIME_S - (level - 1)) * 1000;
}

function createFrog(): Frog {
  const col = Math.floor(COLS / 2);
  return { col, row: ROW_START, animating: false, animT: 0, targetCol: col, targetRow: ROW_START };
}

function createGoals(): Goal[] {
  return GOAL_START_COLS.map((col) => ({ col, width: GOAL_WIDTH, filled: false }));
}

function createInitialState(): FroggerState {
  const roundTimeMaxMs = roundTimeForLevel(1);
  return {
    lanes: buildLanes(1),
    frog: createFrog(),
    goals: createGoals(),
    lives: 3,
    score: 0,
    level: 1,
    minRowReached: ROW_START,
    roundTimeMs: roundTimeMaxMs,
    roundTimeMaxMs,
    clockMs: 0,
    pendingDir: null,
    gameOver: false,
    gameOverNotified: false,
    lastTime: null,
  };
}

// --- Colisiones / soporte / metas -----------------------------------------

function checkRoadCollision(frog: Frog, lanes: Lane[]): boolean {
  const lane = lanes.find((l) => l.row === frog.row);
  if (!lane) return false;
  return lane.entities.some((e) => frog.col >= e.col && frog.col < e.col + e.width);
}

/** Entidad de río que soporta a la rana en su columna/carril actual, o `null` si no hay ninguna (o la tortuga que la soportaría está sumergida). */
function getSupport(frog: Frog, lanes: Lane[]): Entity | null {
  const lane = lanes.find((l) => l.row === frog.row);
  if (!lane) return null;
  const entity = lane.entities.find((e) => frog.col >= e.col && frog.col < e.col + e.width);
  if (!entity) return null;
  if (entity.type === "turtle" && entity.submerged) return null;
  return entity;
}

type GoalOutcome = "filled" | "already-filled" | "not-a-goal";

/** Marca la boca ocupada si corresponde; no puntúa (eso lo decide el llamador, que conoce el tiempo restante). */
function checkGoal(frog: Frog, goals: Goal[]): GoalOutcome {
  const goal = goals.find((g) => frog.col >= g.col && frog.col < g.col + g.width);
  if (!goal) return "not-a-goal";
  if (goal.filled) return "already-filled";
  goal.filled = true;
  return "filled";
}

// --- Ronda / muerte ---------------------------------------------------------

function completeRound(state: FroggerState): void {
  state.frog = createFrog();
  for (const goal of state.goals) goal.filled = false;
  state.level += 1;
  state.lanes = buildLanes(state.level);
  state.roundTimeMaxMs = roundTimeForLevel(state.level);
  state.roundTimeMs = state.roundTimeMaxMs;
  state.minRowReached = ROW_START;
}

function killFrog(state: FroggerState): void {
  state.lives -= 1;
  if (state.lives <= 0) {
    state.lives = 0;
    state.gameOver = true;
    return;
  }
  state.frog = createFrog();
  state.roundTimeMs = state.roundTimeMaxMs;
  state.minRowReached = ROW_START;
}

// --- Loop principal ----------------------------------------------------------

function moveEntities(lanes: Lane[], dt: number) {
  for (const lane of lanes) {
    for (const entity of lane.entities) {
      // lane.speed está en px/frame (spec); entity.col está en celdas, así
      // que además de normalizar por dt/16 (frame a 60fps) hay que dividir
      // por CELL para convertir el desplazamiento en píxeles a columnas.
      entity.col += (lane.speed * lane.dir * dt) / 16 / CELL;
      if (lane.dir === 1 && entity.col > COLS) entity.col = -entity.width;
      if (lane.dir === -1 && entity.col + entity.width < 0) entity.col = COLS;
    }
  }
}

function updateTurtles(lanes: Lane[], clockMs: number) {
  for (const lane of lanes) {
    for (const entity of lane.entities) {
      if (entity.type !== "turtle" || entity.cyclePhase === undefined) continue;
      const phase = (clockMs + entity.cyclePhase) % TURTLE_CYCLE_MS;
      entity.submerged = phase >= TURTLE_VISIBLE_MS;
    }
  }
}

function tryStartJump(state: FroggerState) {
  const dir = state.pendingDir;
  state.pendingDir = null;
  if (!dir) return;
  const { frog } = state;
  let targetCol = frog.col;
  let targetRow = frog.row;
  if (dir === "up") targetRow -= 1;
  else if (dir === "down") targetRow += 1;
  else if (dir === "left") targetCol -= 1;
  else targetCol += 1;
  if (targetCol < 0 || targetCol >= COLS) return;
  if (targetRow < ROW_GOALS || targetRow > ROW_START) return;
  frog.animating = true;
  frog.animT = 0;
  frog.targetCol = targetCol;
  frog.targetRow = targetRow;
}

/** Resuelve la celda de destino tras completar un salto: colisión, soporte o meta. */
function resolveLanding(state: FroggerState) {
  const { frog } = state;
  if (frog.row < state.minRowReached) {
    state.minRowReached = frog.row;
    state.score += 10;
  }

  if (frog.row >= ROW_ROAD_TOP && frog.row <= ROW_ROAD_BOT) {
    if (checkRoadCollision(frog, state.lanes)) killFrog(state);
    return;
  }

  if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
    if (!getSupport(frog, state.lanes)) killFrog(state);
    return;
  }

  if (frog.row === ROW_GOALS) {
    const outcome = checkGoal(frog, state.goals);
    if (outcome === "filled") {
      state.score += 50 + Math.round(state.roundTimeMs / 100); // tiempo_restante(s) * 10
      if (state.goals.every((g) => g.filled)) {
        state.score += 200;
        completeRound(state);
      }
    } else {
      killFrog(state);
    }
  }
}

function updateFrog(state: FroggerState, dt: number) {
  const { frog } = state;
  if (!frog.animating) tryStartJump(state);

  if (frog.animating) {
    frog.animT += dt;
    if (frog.animT >= JUMP_MS) {
      frog.animating = false;
      frog.animT = 0;
      frog.col = frog.targetCol;
      frog.row = frog.targetRow;
      resolveLanding(state);
    }
    return;
  }

  if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
    const lane = state.lanes.find((l) => l.row === frog.row);
    const support = lane ? getSupport(frog, state.lanes) : null;
    if (!lane) return;
    if (!support) {
      killFrog(state);
      return;
    }
    frog.col += (lane.speed * lane.dir * dt) / 16 / CELL;
    if (frog.col < 0 || frog.col > COLS - 1) killFrog(state);
  }
}

function update(state: FroggerState, dt: number) {
  if (state.gameOver) return;
  state.clockMs += dt;
  moveEntities(state.lanes, dt);
  updateTurtles(state.lanes, state.clockMs);
  updateFrog(state, dt);
  if (state.gameOver) return;
  state.roundTimeMs -= dt;
  if (state.roundTimeMs <= 0) {
    state.roundTimeMs = 0;
    killFrog(state);
  }
}

// --- Dibujo --------------------------------------------------------------

/**
 * Deriva un color de zona semitransparente a partir de un campo de la skin
 * (`primary`/`accent`), mezclado por el canvas sobre `skin.bg` (ya pintado
 * antes en el frame). No es un color nuevo fuera de la skin: es una técnica
 * de mezcla alpha reutilizada en las 4 zonas del tablero, igual espíritu que
 * `rgba(${r},${g},${b},skin.fillAlpha)` en TetrisGame.
 */
function zoneTint(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function zoneColorForRow(row: number, skin: GameSkin): string {
  if (row === ROW_GOALS) return zoneTint(skin.primary, 0.28);
  if (row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT) return zoneTint(skin.primary, 0.14);
  if (row === ROW_SAFE_MID) return zoneTint(skin.accent, 0.14);
  // Carretera: asfalto casi negro — se deja igual a skin.bg (cada skin ya
  // define su propio "casi negro": azulado en clasico, puro en neon, cálido
  // en retro), así el asfalto se diferencia solo, sin literal aparte.
  if (row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT) return skin.bg;
  return zoneTint(skin.accent, 0.14); // ROW_START
}

function drawZones(ctx: CanvasRenderingContext2D, skin: GameSkin) {
  for (let r = 0; r < ROWS; r++) {
    ctx.fillStyle = zoneColorForRow(r, skin);
    ctx.fillRect(GRID_X, GRID_Y + r * CELL, GRID_W, CELL);
  }
}

/**
 * Reutiliza `skin.pieces` (paleta de 7 acentos ya verificada ≥3:1 contra
 * `skin.bg` en las 3 skins) como paleta de entidades: coches en variantes
 * 0-2, camión en 6. Troncos toman `skin.accent` (mismo hue que la franja
 * "segura"/orillas: refuerza que un tronco es soporte). Tortugas toman
 * `pieces[3]`, que en las 3 skins ya es un verde — coincide con el verde
 * original y con el marcador de meta ocupada.
 */
function entityColor(
  type: EntityType,
  variant: number,
  skin: GameSkin,
  submerged?: boolean,
): string {
  if (type === "car") return skin.pieces[variant % 3];
  if (type === "truck") return skin.pieces[6];
  if (type === "log") return skin.accent;
  if (submerged) return zoneTint(skin.pieces[3], 0.25);
  return skin.pieces[3]; // turtle
}

function drawEntity(ctx: CanvasRenderingContext2D, lane: Lane, entity: Entity, skin: GameSkin) {
  const x = GRID_X + entity.col * CELL;
  const y = GRID_Y + lane.row * CELL;
  const w = entity.width * CELL;
  const variant = Math.floor((entity.col + lane.row) * 7) % 3;
  const color = entityColor(entity.type, variant, skin, entity.submerged);
  const useGlow = skin.glow > 0;

  if (entity.type === "turtle" && entity.submerged) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 3, y + 8, CELL - 6, CELL - 16);
    return;
  }

  if (useGlow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = skin.glow;
  }
  ctx.fillStyle = color;
  if (entity.type === "turtle") {
    ctx.beginPath();
    ctx.arc(x + CELL / 2, y + CELL / 2, CELL / 2 - 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    return;
  }

  ctx.fillRect(x + 2, y + 6, w - 4, CELL - 12);
  if (useGlow) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 6, w - 4, CELL - 12);
  }
  ctx.shadowBlur = 0;

  // Retro no es un simple recoloreado de clásico: añade una banda de
  // highlight superior, misma técnica (y mismo literal) que el bisel de
  // TetrisGame en su skin retro — detalle de render fijo, no color de skin.
  if (skin.id === "retro") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(x + 2, y + 6, w - 4, 4);
  }

  if (entity.type === "log") {
    // Línea divisoria entre troncos de un mismo grupo: sombreado fijo, no es
    // un color de skin (igual criterio que el bisel de arriba).
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 1;
    for (let i = 1; i < entity.width; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * CELL, y + 6);
      ctx.lineTo(x + i * CELL, y + CELL - 6);
      ctx.stroke();
    }
  } else {
    // Neumáticos/faros traseros: silueta oscura fija, técnica de render
    // (coches y camiones siempre llevan ruedas negras, con cualquier skin).
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(x + 8, y + CELL - 6, 4, 0, Math.PI * 2);
    ctx.arc(x + w - 8, y + CELL - 6, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGoals(ctx: CanvasRenderingContext2D, goals: Goal[], skin: GameSkin) {
  const useGlow = skin.glow > 0;
  for (const goal of goals) {
    const x = GRID_X + goal.col * CELL;
    const y = GRID_Y + ROW_GOALS * CELL;
    const w = goal.width * CELL;
    ctx.fillStyle = zoneTint(skin.primary, 0.35);
    ctx.fillRect(x + 2, y + 2, w - 4, CELL - 4);
    if (useGlow) {
      ctx.shadowColor = skin.primary;
      ctx.shadowBlur = skin.glow;
    }
    ctx.strokeStyle = skin.primary;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, w - 4, CELL - 4);
    ctx.shadowBlur = 0;
    if (goal.filled) {
      ctx.fillStyle = skin.pieces[3];
      if (useGlow) {
        ctx.shadowColor = skin.pieces[3];
        ctx.shadowBlur = skin.glow;
      }
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + CELL / 2, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

function drawFrog(ctx: CanvasRenderingContext2D, frog: Frog, skin: GameSkin) {
  const t = frog.animating ? Math.min(1, frog.animT / JUMP_MS) : 0;
  const col = frog.animating ? frog.col + (frog.targetCol - frog.col) * t : frog.col;
  const row = frog.animating ? frog.row + (frog.targetRow - frog.row) * t : frog.row;
  const cx = GRID_X + col * CELL + CELL / 2;
  const cy = GRID_Y + row * CELL + CELL / 2;
  const hop = frog.animating ? Math.sin(t * Math.PI) * 0.15 : 0;

  ctx.fillStyle = skin.primary;
  if (skin.glow > 0) {
    ctx.shadowColor = skin.primary;
    ctx.shadowBlur = skin.glow;
  }
  ctx.beginPath();
  ctx.ellipse(cx, cy, 14 * (1 + hop), 12 * (1 - hop), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Ojos blanco/negro: silueta fija (esclerótica blanca, pupila negra), igual
  // criterio que los neumáticos de coches/camiones — no depende de la skin.
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx - 5, cy - 6, 3, 0, Math.PI * 2);
  ctx.arc(cx + 5, cy - 6, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(cx - 5, cy - 6, 1.3, 0, Math.PI * 2);
  ctx.arc(cx + 5, cy - 6, 1.3, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * `pieces` mantiene el mismo mapeo semántico en las 3 skins (índice 1 =
 * amarillo, 3 = verde, 4 = rojo/rosado), así que sirve como semáforo de
 * urgencia sin introducir un color fuera de la skin.
 */
function timeBarColor(fraction: number, skin: GameSkin): string {
  if (fraction > 0.5) return skin.pieces[3];
  if (fraction > 0.2) return skin.pieces[1];
  return skin.pieces[4];
}

/** Score/nivel en el panel izquierdo, vidas en el derecho, barra de tiempo sobre la fila de metas. */
function drawHud(ctx: CanvasRenderingContext2D, state: FroggerState, skin: GameSkin) {
  ctx.textAlign = "center";
  ctx.fillStyle = skin.ink;
  ctx.shadowColor = skin.ink;
  ctx.shadowBlur = skin.glow > 0 ? 6 : 0;

  const leftCx = GRID_X / 2;
  ctx.font = "bold 10px monospace";
  ctx.fillText("SCORE", leftCx, 250);
  ctx.font = "bold 16px monospace";
  ctx.fillText(String(state.score), leftCx, 272);
  ctx.font = "bold 10px monospace";
  ctx.fillText("NIVEL", leftCx, 330);
  ctx.font = "bold 16px monospace";
  ctx.fillText(String(state.level), leftCx, 352);

  const rightCx = GRID_X + GRID_W + GRID_X / 2;
  ctx.font = "bold 10px monospace";
  ctx.fillText("VIDAS", rightCx, 200);
  ctx.shadowBlur = 0;
  for (let i = 0; i < state.lives; i++) {
    ctx.fillStyle = skin.primary;
    ctx.beginPath();
    ctx.ellipse(rightCx, 222 + i * 24, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const fraction =
    state.roundTimeMaxMs > 0 ? Math.max(0, state.roundTimeMs) / state.roundTimeMaxMs : 0;
  ctx.fillStyle = timeBarColor(fraction, skin);
  ctx.fillRect(GRID_X, GRID_Y / 2 - 3, GRID_W * fraction, 6);
}

function draw(ctx: CanvasRenderingContext2D, state: FroggerState, skin: GameSkin) {
  ctx.fillStyle = skin.bg;
  ctx.fillRect(0, 0, W, H);
  drawZones(ctx, skin);
  for (const lane of state.lanes) {
    for (const entity of lane.entities) drawEntity(ctx, lane, entity, skin);
  }
  drawGoals(ctx, state.goals, skin);
  drawFrog(ctx, state.frog, skin);
  drawHud(ctx, state, skin);
}

// --- Componente ------------------------------------------------------------

function press(state: FroggerState, code: string) {
  const dir = CODE_TO_DIR[code];
  if (!dir || state.gameOver) return;
  state.pendingDir = dir;
}

export function FroggerGame({
  running,
  onStats,
  onGameOver,
  skin,
  touchInputRef,
}: PlayableGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<FroggerState | null>(null);
  const lastStatsRef = useRef<GameStats>({ score: 0, lives: 3, level: 1 });
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
    lastStatsRef.current = { score: 0, lives: 3, level: 1 };
  }, []);

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
      if (g!.gameOver || e.repeat || !(e.code in CODE_TO_DIR)) return;
      e.preventDefault();
      press(g!, e.code);
    }
    window.addEventListener("keydown", onKeyDown);
    touchInputRef.current = {
      press: (code) => press(g!, code),
      release: () => {},
    };

    function reportStats() {
      const next: GameStats = { score: g!.score, lives: g!.lives, level: g!.level };
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

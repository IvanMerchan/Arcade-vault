"use client";

import { useEffect, useRef } from "react";
import type { GameStats, PlayableGameProps } from "@/lib/game-registry";
import { hexToRgb, type GameSkin } from "@/lib/game-skins";

const W = 800;
const H = 600;

const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

/** Aplica (o limpia) el glow de la skin activa sobre el contexto antes/después de un trazo. */
function withGlow(ctx: CanvasRenderingContext2D, skin: GameSkin, color: string, draw: () => void) {
  if (skin.glow > 0) {
    ctx.shadowBlur = skin.glow;
    ctx.shadowColor = color;
  }
  draw();
  if (skin.glow > 0) ctx.shadowBlur = 0;
}

class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  radius: number;
  dead: boolean;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, skin: GameSkin) {
    withGlow(ctx, skin, skin.primary, () => {
      ctx.fillStyle = skin.primary;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

const RADII = [0, 16, 30, 50];
const SPEEDS = [0, 85, 55, 32];
const POINTS = [0, 100, 50, 20];

class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  dead: boolean;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][];

  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw(ctx: CanvasRenderingContext2D, skin: GameSkin) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = skin.primary;
    // La skin retro usa un trazo más grueso, sin glow — técnica de vector CRT
    // fosforescente en vez del relleno translúcido con shadowBlur de neón.
    ctx.lineWidth = skin.id === "retro" ? 2 : 1.5;
    ctx.lineJoin = "round";
    withGlow(ctx, skin, skin.primary, () => {
      ctx.beginPath();
      ctx.moveTo(this.verts[0][0], this.verts[0][1]);
      for (let i = 1; i < this.verts.length; i++) ctx.lineTo(this.verts[i][0], this.verts[i][1]);
      ctx.closePath();
      ctx.stroke();
    });
    ctx.restore();
  }
}

class Ship {
  x = 0;
  y = 0;
  angle = 0;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 0;
  shootCooldown = 0;
  dead = false;

  constructor() {
    this.reset();
  }

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, keys: Record<string, boolean>) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const ROT = 3.5;
    const THRUST = 260;
    const DRAG = 0.987;

    if (keys["ArrowLeft"]) this.angle -= ROT * dt;
    if (keys["ArrowRight"]) this.angle += ROT * dt;

    this.thrusting = !!keys["ArrowUp"];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D, skin: GameSkin) {
    if (this.dead) return;
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = skin.primary;
    ctx.lineWidth = skin.id === "retro" ? 2 : 1.5;
    ctx.lineJoin = "round";

    withGlow(ctx, skin, skin.primary, () => {
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-12, -9);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-12, 9);
      ctx.closePath();
      ctx.stroke();
    });

    if (this.thrusting && Math.random() > 0.35) {
      withGlow(ctx, skin, skin.accent, () => {
        ctx.beginPath();
        ctx.moveTo(-8, -4);
        ctx.lineTo(-8 - rand(6, 14), 0);
        ctx.lineTo(-8, 4);
        ctx.strokeStyle = skin.accent;
        ctx.stroke();
      });
    }

    ctx.restore();
  }
}

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead: boolean;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
    this.dead = false;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, skin: GameSkin) {
    const alpha = this.ttl / this.life;
    const { r, g, b } = hexToRgb(skin.primary);
    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

function spawnAsteroids(list: Asteroid[], count: number) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x: number, y: number;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    list.push(new Asteroid(x, y, 3));
  }
}

type GameLifecycle = "playing" | "dead" | "gameover";

type GameState = {
  ship: Ship;
  bullets: Bullet[];
  asteroids: Asteroid[];
  particles: Particle[];
  score: number;
  lives: number;
  level: number;
  state: GameLifecycle;
  deadTimer: number;
  keys: Record<string, boolean>;
  justPressed: Record<string, boolean>;
  lastTime: number | null;
  gameOverNotified: boolean;
};

function createInitialState(): GameState {
  const asteroids: Asteroid[] = [];
  spawnAsteroids(asteroids, 4);
  return {
    ship: new Ship(),
    bullets: [],
    asteroids,
    particles: [],
    score: 0,
    lives: 3,
    level: 1,
    state: "playing",
    deadTimer: 0,
    keys: {},
    justPressed: {},
    lastTime: null,
    gameOverNotified: false,
  };
}

export function AsteroidsGame({ running, onStats, onGameOver, skin }: PlayableGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
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

  // Si el jugador cambia de skin mientras está en pausa, el loop de rAF no está
  // corriendo para repintar con el frame nuevo — se repinta una vez a mano para
  // que el cambio se vea de inmediato en vez de esperar a reanudar.
  useEffect(() => {
    if (running) return;
    const ctx = canvasRef.current?.getContext("2d");
    const g = gameRef.current;
    if (!ctx || !g) return;
    ctx.fillStyle = skin.bg;
    ctx.fillRect(0, 0, W, H);
    g.particles.forEach((p) => p.draw(ctx, skin));
    g.asteroids.forEach((a) => a.draw(ctx, skin));
    g.bullets.forEach((b) => b.draw(ctx, skin));
    g.ship.draw(ctx, skin);
  }, [skin, running]);

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    const g = gameRef.current;
    if (!canvas || !g) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function onKeyDown(e: KeyboardEvent) {
      g!.justPressed[e.code] = !g!.keys[e.code];
      g!.keys[e.code] = true;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code))
        e.preventDefault();
    }
    function onKeyUp(e: KeyboardEvent) {
      g!.keys[e.code] = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    function pressed(code: string) {
      const val = g!.justPressed[code];
      g!.justPressed[code] = false;
      return val;
    }

    function explode(x: number, y: number, count = 8) {
      for (let i = 0; i < count; i++) g!.particles.push(new Particle(x, y));
    }

    function killShip() {
      explode(g!.ship.x, g!.ship.y, 14);
      g!.ship.dead = true;
      g!.lives--;
      if (g!.lives <= 0) {
        g!.state = "gameover";
      } else {
        g!.state = "dead";
        g!.deadTimer = 2;
      }
    }

    function nextLevel() {
      g!.level++;
      g!.bullets = [];
      g!.particles = [];
      g!.ship.reset();
      spawnAsteroids(g!.asteroids, 3 + g!.level);
    }

    function update(dt: number) {
      const state = g!;

      if (state.state === "gameover") {
        state.particles.forEach((p) => p.update(dt));
        state.particles = state.particles.filter((p) => !p.dead);
        return;
      }

      if (state.state === "dead") {
        state.deadTimer -= dt;
        state.particles.forEach((p) => p.update(dt));
        state.particles = state.particles.filter((p) => !p.dead);
        state.asteroids.forEach((a) => a.update(dt));
        if (state.deadTimer <= 0) {
          state.state = "playing";
          state.ship.reset();
        }
        return;
      }

      if (pressed("Space")) state.bullets.push(...state.ship.tryShoot());

      state.ship.update(dt, state.keys);
      state.bullets.forEach((b) => b.update(dt));
      state.asteroids.forEach((a) => a.update(dt));
      state.particles.forEach((p) => p.update(dt));

      state.bullets = state.bullets.filter((b) => !b.dead);
      state.particles = state.particles.filter((p) => !p.dead);

      const newAsteroids: Asteroid[] = [];
      for (const b of state.bullets) {
        for (const a of state.asteroids) {
          if (!a.dead && !b.dead && dist(b, a) < a.radius) {
            b.dead = true;
            a.dead = true;
            state.score += POINTS[a.size];
            explode(a.x, a.y, a.size * 5);
            newAsteroids.push(...a.split());
          }
        }
      }
      state.asteroids = state.asteroids.filter((a) => !a.dead).concat(newAsteroids);
      state.bullets = state.bullets.filter((b) => !b.dead);

      if (state.ship.invincible <= 0) {
        for (const a of state.asteroids) {
          if (dist(state.ship, a) < state.ship.radius + a.radius * 0.82) {
            killShip();
            break;
          }
        }
      }

      if (state.asteroids.length === 0) nextLevel();
    }

    function draw() {
      const currentSkin = skinRef.current;
      ctx!.fillStyle = currentSkin.bg;
      ctx!.fillRect(0, 0, W, H);
      g!.particles.forEach((p) => p.draw(ctx!, currentSkin));
      g!.asteroids.forEach((a) => a.draw(ctx!, currentSkin));
      g!.bullets.forEach((b) => b.draw(ctx!, currentSkin));
      g!.ship.draw(ctx!, currentSkin);
    }

    function reportStats() {
      const next: GameStats = { score: g!.score, lives: Math.max(g!.lives, 0), level: g!.level };
      const prev = lastStatsRef.current;
      if (next.score !== prev.score || next.lives !== prev.lives || next.level !== prev.level) {
        lastStatsRef.current = next;
        onStatsRef.current(next);
      }
    }

    let raf = 0;
    function loop(ts: number) {
      const dt = g!.lastTime === null ? 0 : Math.min((ts - g!.lastTime) / 1000, 0.05);
      g!.lastTime = ts;
      update(dt);
      draw();
      reportStats();
      if (g!.state === "gameover" && !g!.gameOverNotified) {
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

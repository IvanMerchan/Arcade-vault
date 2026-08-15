"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Game } from "@/lib/games";
import { useSession } from "@/components/SessionProvider";
import { isPlayable, type TouchInputHandle } from "@/lib/game-registry";
import { AsteroidsGame } from "@/components/AsteroidsGame";
import { TetrisGame } from "@/components/TetrisGame";
import { SkinSwitch } from "@/components/SkinSwitch";
import { TouchControls } from "@/components/TouchControls";
import { getTouchLayout } from "@/lib/touch-controls";
import { DEFAULT_SKIN, getSkin, type SkinId } from "@/lib/game-skins";

const SKIN_STORAGE_KEY = "arcade-vault:skin";

export function PlayerScreen({ game }: { game: Game }) {
  const { user, saveScore } = useSession();
  const Playable = isPlayable(game.id);
  const [skinId, setSkinId] = useState<SkinId>(DEFAULT_SKIN);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameLevel, setGameLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [playId, setPlayId] = useState(0);
  const touchInputRef = useRef<TouchInputHandle | null>(null);
  const touchLayout = Playable ? getTouchLayout(game.id) : null;
  const level = Playable ? gameLevel : Math.floor(score / 2500) + 1;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync display name to session user resolved after mount
    setName(user ? user.name : "INVITADO");
  }, [user]);

  useEffect(() => {
    document.body.classList.add("is-playing");
    return () => document.body.classList.remove("is-playing");
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(SKIN_STORAGE_KEY) as SkinId | null;
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync persisted skin preference resolved after mount
      setSkinId(stored);
    }
  }, []);

  const handleSkinChange = (id: SkinId) => {
    setSkinId(id);
    window.localStorage.setItem(SKIN_STORAGE_KEY, id);
  };
  const skin = getSkin(skinId);

  useEffect(() => {
    if (Playable || over || paused) return;
    const t = setInterval(() => setScore((s) => s + Math.floor(10 + Math.random() * 90)), 220);
    return () => clearInterval(t);
  }, [Playable, over, paused]);

  useEffect(() => {
    if (!touchLayout || (!paused && !over)) return;
    for (const btn of touchLayout) touchInputRef.current?.release(btn.code);
  }, [touchLayout, paused, over]);

  const endGame = () => setOver(true);
  const restart = () => {
    setScore(0);
    setLives(3);
    setGameLevel(1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaving(false);
    setSaveError(null);
    setPlayId((id) => id + 1);
  };
  const handleSaveScore = async () => {
    setSaving(true);
    setSaveError(null);
    const result = await saveScore({ game: game.id, score, name });
    setSaving(false);
    if (result.ok) {
      setSaved(true);
    } else {
      setSaveError(result.error);
    }
  };
  const handleStats = (stats: { score: number; lives: number; level: number }) => {
    setScore(stats.score);
    setLives(stats.lives);
    setGameLevel(stats.level);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          {Playable && <SkinSwitch value={skinId} onChange={handleSkinChange} />}
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <Link className="btn ghost" href={`/juegos/${game.id}`}>
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {game.id === "asteroides" ? (
            <AsteroidsGame
              key={playId}
              running={!paused && !over}
              onStats={handleStats}
              onGameOver={endGame}
              skin={skin}
              touchInputRef={touchInputRef}
            />
          ) : game.id === "caida" ? (
            <TetrisGame
              key={playId}
              running={!paused && !over}
              onStats={handleStats}
              onGameOver={endGame}
              skin={skin}
              touchInputRef={touchInputRef}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {touchLayout && (
        <TouchControls
          buttons={touchLayout}
          skin={skin}
          onPress={(code) => touchInputRef.current?.press(code)}
          onRelease={(code) => touchInputRef.current?.release(code)}
        />
      )}

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="TUS INICIALES"
                  disabled={saving}
                  inputMode="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button className="btn yellow" onClick={handleSaveScore} disabled={saving}>
                  {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            {saveError && (
              <div
                className="toast-saved"
                style={{ color: "var(--magenta)", textShadow: "0 0 8px var(--magenta)" }}
              >
                ▸ NO SE PUDO GUARDAR: {saveError}
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link className="btn magenta" href="/">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

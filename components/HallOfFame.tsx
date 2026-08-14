"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatScoreDate, type Game, type ScoreRow } from "@/lib/games";
import { useSession } from "@/components/SessionProvider";
import { createClient } from "@/lib/supabase/client";

type YourBest = { score: number; rank: number; date: string };

export function HallOfFame({
  games,
  scoresByGame,
}: {
  games: Game[];
  scoresByGame: Record<string, ScoreRow[]>;
}) {
  const [tab, setTab] = useState(games[0].id);
  const { user } = useSession();
  const rows = scoresByGame[tab] ?? [];
  const game = games.find((g) => g.id === tab);
  const [yourBest, setYourBest] = useState<YourBest | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadYourBest() {
      if (!user) {
        if (!cancelled) setYourBest(null);
        return;
      }
      const supabase = createClient();
      const { data: best } = await supabase
        .from("scores")
        .select("score, created_at")
        .eq("game_id", tab)
        .eq("player_name", user.name)
        .order("score", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!best) {
        if (!cancelled) setYourBest(null);
        return;
      }
      const { count } = await supabase
        .from("scores")
        .select("*", { count: "exact", head: true })
        .eq("game_id", tab)
        .gt("score", best.score);
      if (!cancelled) {
        setYourBest({
          score: best.score,
          rank: (count ?? 0) + 1,
          date: formatScoreDate(best.created_at),
        });
      }
    }
    loadYourBest();
    return () => {
      cancelled = true;
    };
  }, [tab, user]);

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ink-faint)" }}>
          <div
            className="pixel"
            style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}
          >
            AÚN NO HAY PUNTUACIONES
          </div>
          <div>Sé el primero en aparecer en el Salón de la Fama.</div>
        </div>
      ) : (
        <>
          <div className="podium">
            {rows[1] && (
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{rows[1].name}</div>
                <div className="score">{rows[1].score.toLocaleString("es-ES")}</div>
                <div className="date">{rows[1].date}</div>
              </div>
            )}
            {rows[0] && (
              <div className="podium-slot gold">
                <div
                  className="pixel"
                  style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}
                >
                  CAMPEÓN
                </div>
                <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
                  01
                </div>
                <div className="name">{rows[0].name}</div>
                <div className="score" style={{ fontSize: 20 }}>
                  {rows[0].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{rows[0].date}</div>
              </div>
            )}
            {rows[2] && (
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{rows[2].name}</div>
                <div className="score">{rows[2].score.toLocaleString("es-ES")}</div>
                <div className="date">{rows[2].date}</div>
              </div>
            )}
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.name + i}
                className={"tr" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
            {user && yourBest && (
              <>
                <div className="tr you-label">▸ TU MEJOR MARCA EN {game?.title}</div>
                <div className="tr you" style={{ animationDelay: `${rows.length * 50 + 50}ms` }}>
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    #{String(yourBest.rank).padStart(2, "0")}
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {user.name}
                  </div>
                  <div
                    className="sc"
                    style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}
                  >
                    {yourBest.score.toLocaleString("es-ES")}
                  </div>
                  <div className="dt">{yourBest.date}</div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link className="btn lg" href="/">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}

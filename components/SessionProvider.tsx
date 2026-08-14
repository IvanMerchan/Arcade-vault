"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

type User = { name: string };

type ScoreEntry = {
  game: string;
  score: number;
  name: string;
};

export type SaveScoreResult = { ok: true } | { ok: false; error: string };

type SessionContextValue = {
  user: User | null;
  signIn: (user: User) => void;
  signOut: () => void;
  saveScore: (entry: ScoreEntry) => Promise<SaveScoreResult>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Read after mount, not in the initializer: the server has no localStorage,
    // so matching its render (guest) first avoids a hydration mismatch.
    try {
      const stored = JSON.parse(localStorage.getItem("av_user") || "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setUser(stored);
    } catch {
      // localStorage unavailable or corrupted; keep guest state
    }
  }, []);

  const signIn = (nextUser: User) => {
    setUser(nextUser);
    try {
      localStorage.setItem("av_user", JSON.stringify(nextUser));
    } catch {
      // ignore persistence failure
    }
  };

  const signOut = () => {
    setUser(null);
    try {
      localStorage.removeItem("av_user");
    } catch {
      // ignore persistence failure
    }
  };

  const saveScore = async (entry: ScoreEntry): Promise<SaveScoreResult> => {
    const supabase = createClient();
    const { error } = await supabase.from("scores").insert({
      game_id: entry.game,
      player_name: entry.name,
      score: entry.score,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  return (
    <SessionContext.Provider value={{ user, signIn, signOut, saveScore }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}

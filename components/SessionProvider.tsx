"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type User = { name: string };

type ScoreEntry = {
  game: string;
  score: number;
  name: string;
  at: number;
};

type SessionContextValue = {
  user: User | null;
  signIn: (user: User) => void;
  signOut: () => void;
  saveScore: (entry: Omit<ScoreEntry, "at">) => void;
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

  const saveScore = (entry: Omit<ScoreEntry, "at">) => {
    try {
      const all = JSON.parse(localStorage.getItem("av_scores") || "[]");
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem("av_scores", JSON.stringify(all));
    } catch {
      // ignore persistence failure
    }
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

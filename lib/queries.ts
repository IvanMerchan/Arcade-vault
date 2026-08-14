import { createClient, createStaticClient } from "@/lib/supabase/server";
import type { Game, GameCategory, GameColor } from "@/lib/games";
import type { Tables } from "@/database.types";

type GameRow = Omit<Game, "best" | "plays">;

type GameSelectRow = Pick<
  Tables<"games">,
  "id" | "title" | "short" | "long" | "cat" | "cover" | "color"
>;

// El codegen de Supabase no conserva los CHECK constraints de cat/color como
// union de literales; el cast es seguro porque la base los valida al insertar.
function toGameRow(row: GameSelectRow): GameRow {
  return { ...row, cat: row.cat as GameCategory, color: row.color as GameColor };
}

async function withStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: GameRow[],
): Promise<Game[]> {
  const { data: stats, error } = await supabase
    .from("game_stats")
    .select("game_id, best, plays")
    .in(
      "game_id",
      rows.map((g) => g.id),
    );
  if (error) throw error;

  const byId = new Map((stats ?? []).filter((s) => s.game_id !== null).map((s) => [s.game_id, s]));

  return rows.map((g) => {
    const s = byId.get(g.id);
    return { ...g, best: s?.best ?? 0, plays: String(s?.plays ?? 0) };
  });
}

export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, title, short, long, cat, cover, color")
    .order("sort_order", { ascending: true });
  if (error) throw error;

  return withStats(supabase, (data ?? []).map(toGameRow));
}

export async function getGameById(id: string): Promise<Game | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, title, short, long, cat, cover, color")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;

  const [game] = await withStats(supabase, [toGameRow(data)]);
  return game;
}

export async function getGameIds(): Promise<string[]> {
  // Usado desde generateStaticParams (build time, sin cookies disponibles);
  // getGames()/getGameById() sí usan el cliente de servidor con cookies.
  const supabase = createStaticClient();
  const { data, error } = await supabase
    .from("games")
    .select("id")
    .order("sort_order", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((g) => g.id);
}

import { notFound } from "next/navigation";
import { GAMES, getGame } from "@/lib/games";
import { PlayerScreen } from "@/components/PlayerScreen";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export default async function PlayerPage({ params }: PageProps<"/jugar/[id]">) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  return <PlayerScreen game={game} />;
}

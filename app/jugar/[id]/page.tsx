import { notFound } from "next/navigation";
import { getGameById, getGameIds } from "@/lib/queries";
import { PlayerScreen } from "@/components/PlayerScreen";

export async function generateStaticParams() {
  const ids = await getGameIds();
  return ids.map((id) => ({ id }));
}

export default async function PlayerPage({ params }: PageProps<"/jugar/[id]">) {
  const { id } = await params;
  const game = await getGameById(id);
  if (!game) notFound();

  return <PlayerScreen game={game} />;
}

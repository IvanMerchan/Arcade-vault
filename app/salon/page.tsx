import { getGames } from "@/lib/queries";
import { HallOfFame } from "@/components/HallOfFame";

export default async function HallOfFamePage() {
  const games = await getGames();
  return <HallOfFame games={games} />;
}

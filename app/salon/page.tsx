import { getGames, getAllTopScores } from "@/lib/queries";
import { HallOfFame } from "@/components/HallOfFame";

export default async function HallOfFamePage() {
  const games = await getGames();
  const scoresByGame = await getAllTopScores(
    games.map((g) => g.id),
    12,
  );
  return <HallOfFame games={games} scoresByGame={scoresByGame} />;
}

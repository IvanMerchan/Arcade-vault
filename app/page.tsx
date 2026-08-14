import { getGames } from "@/lib/queries";
import { Home } from "@/components/Home";

export default async function Page() {
  const games = await getGames();
  return <Home games={games} />;
}

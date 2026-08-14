import { getGames } from "@/lib/queries";
import { LibraryScreen } from "@/components/LibraryScreen";

export default async function Page() {
  const games = await getGames();
  return <LibraryScreen games={games} />;
}

import { GAMES } from "@/lib/games";
import { LibraryScreen } from "@/components/LibraryScreen";

export default function Home() {
  return <LibraryScreen games={GAMES} />;
}

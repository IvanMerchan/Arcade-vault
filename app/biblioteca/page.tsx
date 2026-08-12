import { GAMES } from "@/lib/games";
import { LibraryScreen } from "@/components/LibraryScreen";

export default function Page() {
  return <LibraryScreen games={GAMES} />;
}

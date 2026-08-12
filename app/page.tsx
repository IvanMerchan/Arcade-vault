import { GAMES } from "@/lib/games";
import { Home } from "@/components/Home";

export default function Page() {
  return <Home games={GAMES} />;
}

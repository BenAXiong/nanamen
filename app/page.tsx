import { getLessons } from "@/lib/lessons.server";
import { Screen } from "@/components/Screen";
import { HomeClient } from "@/components/HomeClient";

export default function HomePage() {
  const lessons = getLessons();

  return (
    <Screen>
      <HomeClient lessons={lessons} />
    </Screen>
  );
}

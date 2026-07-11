import { getAllPairs, getLesson } from "@/lib/lessons.server";
import { Screen, ScreenHeader } from "@/components/Screen";
import { PracticeWeakClient } from "@/components/PracticeWeakClient";

export default async function PracticeWeakPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { lesson: lessonSlug } = await searchParams;
  const lesson = lessonSlug ? getLesson(lessonSlug) : undefined;
  const allPairs = getAllPairs();

  return (
    <Screen>
      <ScreenHeader title="Practice weak items" subtitle={lesson?.title ?? "All lessons"} backHref="/" />
      <PracticeWeakClient allPairs={allPairs} lessonSlug={lesson?.slug} />
    </Screen>
  );
}

import { notFound } from "next/navigation";
import { getSection } from "@/lib/content";
import { Screen, ScreenHeader } from "@/components/Screen";
import { SentenceListClient } from "@/components/SentenceListClient";

export default async function SentenceListPage({
  params,
}: {
  params: Promise<{ lesson: string; section: string }>;
}) {
  const { lesson: lessonSlug, section: sectionSlug } = await params;
  const found = getSection(lessonSlug, sectionSlug);
  if (!found) notFound();
  const { lesson, section } = found;

  return (
    <Screen>
      <ScreenHeader title={section.title} subtitle={lesson.title} backHref={`/l/${lesson.slug}`} />
      <SentenceListClient lesson={lesson} section={section} />
    </Screen>
  );
}

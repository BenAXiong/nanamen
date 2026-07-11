import { notFound } from "next/navigation";
import { getSection } from "@/lib/content";
import { Screen, ScreenHeader } from "@/components/Screen";
import { FluencyDrill } from "@/components/FluencyDrill";

export default async function FluencyPage({
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
      <ScreenHeader title={`${section.title} · Fluency`} subtitle={lesson.title} backHref={`/l/${lesson.slug}`} />
      <FluencyDrill lesson={lesson} section={section} />
    </Screen>
  );
}

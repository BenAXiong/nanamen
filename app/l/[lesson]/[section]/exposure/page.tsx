import { notFound } from "next/navigation";
import { getSection } from "@/lib/content";
import { Screen, ScreenHeader } from "@/components/Screen";
import { ExposureClient } from "@/components/ExposureClient";

export default async function ExposurePage({
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
      <ScreenHeader title={`${section.title} · Exposure`} subtitle={lesson.title} backHref={`/l/${lesson.slug}`} />
      <ExposureClient lesson={lesson} section={section} />
    </Screen>
  );
}

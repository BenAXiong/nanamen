import Link from "next/link";
import { notFound } from "next/navigation";
import { getLesson, getPairs } from "@/lib/content";
import { Screen, ScreenHeader } from "@/components/Screen";

export default async function LessonPage({ params }: { params: Promise<{ lesson: string }> }) {
  const { lesson: lessonSlug } = await params;
  const lesson = getLesson(lessonSlug);
  if (!lesson) notFound();

  return (
    <Screen>
      <ScreenHeader title={lesson.title} backHref="/" />

      <div className="flex flex-col gap-3">
        {lesson.sections.map((section) => {
          const pairCount = getPairs(lesson, section).length;
          return (
            <div
              key={section.slug}
              className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900"
            >
              <div className="mb-3">
                <div className="font-medium text-stone-900 dark:text-stone-50">{section.title}</div>
                <div className="text-sm text-stone-500 dark:text-stone-400">
                  {section.sentences.length} sentence{section.sentences.length === 1 ? "" : "s"}
                  {pairCount > 0 ? ` · ${pairCount} pair${pairCount === 1 ? "" : "s"}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/l/${lesson.slug}/${section.slug}/exposure`}
                  className="flex-1 rounded-lg bg-stone-900 px-3 py-2 text-center text-sm font-medium text-white transition active:scale-95 dark:bg-stone-100 dark:text-stone-900"
                >
                  Exposure
                </Link>
                <Link
                  href={`/l/${lesson.slug}/${section.slug}/fluency`}
                  className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-center text-sm font-medium text-white transition active:scale-95 hover:bg-amber-600"
                >
                  Fluency
                </Link>
                <Link
                  href={`/l/${lesson.slug}/${section.slug}/list`}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-center text-sm font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
                >
                  List
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}

import Link from "next/link";
import { getLessons } from "@/lib/lessons.server";
import { Screen } from "@/components/Screen";
import { PracticeWeakEntry } from "@/components/PracticeWeakEntry";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function HomePage() {
  const lessons = getLessons();

  return (
    <Screen>
      <header className="flex items-start justify-between py-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">Nanamen</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">Amis · Malan</p>
        </div>
        <ThemeToggle />
      </header>

      <PracticeWeakEntry lessons={lessons.map((l) => ({ slug: l.slug, title: l.title }))} />

      <div className="mt-6 flex flex-col gap-3">
        {lessons.map((lesson) => (
          <Link
            key={lesson.slug}
            href={`/l/${lesson.slug}`}
            className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition active:scale-[0.99] dark:border-stone-800 dark:bg-stone-900"
          >
            <div>
              <div className="font-medium text-stone-900 dark:text-stone-50">{lesson.title}</div>
              <div className="text-sm text-stone-500 dark:text-stone-400">
                {lesson.sections.length} section{lesson.sections.length === 1 ? "" : "s"}
              </div>
            </div>
            <span className="text-stone-400">›</span>
          </Link>
        ))}
      </div>
    </Screen>
  );
}

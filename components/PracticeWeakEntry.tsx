"use client";

import Link from "next/link";
import { useNanamenState } from "@/lib/state";

export function PracticeWeakEntry({ lessons }: { lessons: { slug: string; title: string }[] }) {
  const { weakPairIds } = useNanamenState();

  if (weakPairIds.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-amber-900 dark:text-amber-100">Practice weak items</div>
          <div className="text-sm text-amber-700 dark:text-amber-300">
            {weakPairIds.length} pair{weakPairIds.length === 1 ? "" : "s"} to strengthen
          </div>
        </div>
        <Link
          href="/practice-weak"
          className="rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white transition active:scale-95 hover:bg-amber-600"
        >
          All
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {lessons.map((lesson) => (
          <Link
            key={lesson.slug}
            href={`/practice-weak?lesson=${lesson.slug}`}
            className="rounded-full border border-amber-300 px-3 py-1 text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900"
          >
            {lesson.title}
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import type { RekadLesson } from "@/lib/rekadImport.server";

export function LessonPicker({ lessons, selected }: { lessons: RekadLesson[]; selected: number }) {
  const router = useRouter();

  return (
    <select
      value={selected}
      onChange={(e) => router.push(`/edit?lesson=${e.target.value}`)}
      className="rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
    >
      {lessons.map((lesson) => (
        <option key={lesson.number} value={lesson.number}>
          {lesson.name}
        </option>
      ))}
    </select>
  );
}

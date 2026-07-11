"use client";

import { useRouter } from "next/navigation";
import type { RekadLesson } from "@/lib/rekadImport.server";

export function LessonPicker({ lessons, selected }: { lessons: RekadLesson[]; selected: number }) {
  const router = useRouter();

  return (
    <select
      value={selected}
      onChange={(e) => router.push(`/edit?lesson=${e.target.value}`)}
      className="flex-1 rounded-lg border border-stone-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
    >
      {lessons.map((lesson) => (
        <option key={lesson.number} value={lesson.number}>
          {lesson.name}
        </option>
      ))}
    </select>
  );
}

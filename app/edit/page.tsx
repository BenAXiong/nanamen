import { notFound } from "next/navigation";
import Link from "next/link";
import { Screen } from "@/components/Screen";
import { LessonPicker } from "@/components/LessonPicker";
import { EditTabs } from "@/components/EditTabs";
import { getAllRekadLessons, getLessonSentences, readManualConfig } from "@/lib/rekadImport.server";

export const dynamic = "force-dynamic";

export default async function EditPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  const { lesson } = await searchParams;
  const lessons = await getAllRekadLessons();

  if (lessons.length === 0) {
    return (
      <Screen>
        <p className="pt-6 text-sm text-stone-500 dark:text-stone-400">No lessons in Airtable yet.</p>
      </Screen>
    );
  }

  const requestedNumber = lesson ? Number(lesson) : null;
  const selected =
    lessons.find((l) => l.number === requestedNumber) ?? lessons[lessons.length - 1];

  const sentences = await getLessonSentences(selected.number);
  const initialConfig = await readManualConfig(selected.number);

  return (
    <Screen>
      <div className="flex flex-col gap-3 pt-4">
        <div className="flex items-center gap-2">
          <LessonPicker lessons={lessons} selected={selected.number} />
          <Link
            href="/import"
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
          >
            Import
          </Link>
        </div>
        <EditTabs lessonNumber={selected.number} sentences={sentences} initialConfig={initialConfig} />
      </div>
    </Screen>
  );
}

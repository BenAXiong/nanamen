import { notFound } from "next/navigation";
import { Screen, ScreenHeader } from "@/components/Screen";
import { RekadImportButton } from "@/components/RekadImportButton";
import { SectionAssignForm } from "@/components/SectionAssignForm";
import { getLessonSentences, getMaxRekadNumberPublic, readManualConfig } from "@/lib/rekadImport.server";

export const dynamic = "force-dynamic";

export default async function RekadImportPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const maxLesson = await getMaxRekadNumberPublic();
  const sentences = maxLesson > 0 ? await getLessonSentences(maxLesson) : [];
  const initialConfig = maxLesson > 0 ? await readManualConfig(maxLesson) : null;

  return (
    <Screen>
      <ScreenHeader title="Rekad import" subtitle="SashaWaves → Airtable" backHref="/" />
      <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
        Checks the current max &ldquo;Rekad N&rdquo; lesson in Airtable, then imports the next one from
        SashaWaves if it&apos;s available. Never re-imports or overwrites an existing lesson.
      </p>
      <RekadImportButton />

      {maxLesson > 0 ? (
        <div className="mt-8 border-t border-stone-200 pt-6 dark:border-stone-800">
          <h2 className="mb-3 text-base font-semibold text-stone-900 dark:text-stone-50">
            Assign sections — Rekad {maxLesson}
          </h2>
          <SectionAssignForm lessonNumber={maxLesson} sentences={sentences} initialConfig={initialConfig} />
        </div>
      ) : null}
    </Screen>
  );
}

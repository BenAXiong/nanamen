import { notFound } from "next/navigation";
import { Screen } from "@/components/Screen";
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
      <div className="pt-4">
        <RekadImportButton />
      </div>

      {maxLesson > 0 ? (
        <div className="mt-4 border-t border-stone-200 pt-4 dark:border-stone-800">
          <SectionAssignForm lessonNumber={maxLesson} sentences={sentences} initialConfig={initialConfig} />
        </div>
      ) : null}
    </Screen>
  );
}

import { Screen } from "@/components/Screen";
import { RekadImportButton } from "@/components/RekadImportButton";
import { SectionAssignForm } from "@/components/SectionAssignForm";
import { getLessonSentences, getMaxRekadNumberPublic, readManualConfig } from "@/lib/rekadImport.server";

export const dynamic = "force-dynamic";

export default async function RekadImportPage() {
  const maxLesson = await getMaxRekadNumberPublic();
  const sentences = maxLesson > 0 ? await getLessonSentences(maxLesson) : [];
  const initialConfig = maxLesson > 0 ? await readManualConfig(maxLesson) : null;
  // Once any section has been assigned, this lesson's initial-seeding job is
  // done -- further tweaks happen on /edit. Keeps this panel empty until the
  // next import lands fresh, all-blank content.
  const needsSectioning = maxLesson > 0 && sentences.every((s) => !s.section);

  return (
    <Screen>
      <div className="pt-4">
        <RekadImportButton />
      </div>

      {needsSectioning ? (
        <div className="mt-4 border-t border-stone-200 pt-4 dark:border-stone-800">
          <SectionAssignForm
            lessonNumber={maxLesson}
            sentences={sentences}
            initialConfig={initialConfig}
            onSuccessMode="redirect"
            redirectTo="/edit"
          />
        </div>
      ) : null}
    </Screen>
  );
}

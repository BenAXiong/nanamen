"use server";

import {
  checkAndImportNextLesson,
  applySectionsToLesson,
  type ImportResult,
  type ApplySectionsResult,
  type SectionEntry,
} from "@/lib/rekadImport.server";

// No dev-only gate here (and no auth) -- this needs to work from a deployed
// production build so Ben can edit content from his phone while away. The
// URL itself is the only protection; that's a deliberate accepted tradeoff.

export async function runRekadImport(): Promise<ImportResult> {
  try {
    return await checkAndImportNextLesson();
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

export async function applySections(
  lessonNumber: number,
  classDate: string,
  entries: SectionEntry[],
): Promise<ApplySectionsResult> {
  try {
    return await applySectionsToLesson(lessonNumber, classDate, entries);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

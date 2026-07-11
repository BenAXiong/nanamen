"use server";

import {
  checkAndImportNextLesson,
  applySectionsToLesson,
  type ImportResult,
  type ApplySectionsResult,
  type SectionEntry,
} from "@/lib/rekadImport.server";

// Dev-only: never lets this write path run in a deployed/production build, so
// it can't become a live public write endpoint if the app is ever deployed.
function requireDev<T>(fallback: T): T | null {
  return process.env.NODE_ENV === "development" ? null : fallback;
}

export async function runRekadImport(): Promise<ImportResult> {
  const blocked = requireDev<ImportResult>({
    status: "error",
    message: "Rekad import only runs in local development (npm run dev).",
  });
  if (blocked) return blocked;
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
  const blocked = requireDev<ApplySectionsResult>({
    status: "error",
    message: "Rekad import only runs in local development (npm run dev).",
  });
  if (blocked) return blocked;
  try {
    return await applySectionsToLesson(lessonNumber, classDate, entries);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

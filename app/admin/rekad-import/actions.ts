"use server";

import { checkAndImportNextLesson, type ImportResult } from "@/lib/rekadImport.server";

// Dev-only: never lets this write path run in a deployed/production build, so
// it can't become a live public write endpoint if the app is ever deployed.
export async function runRekadImport(): Promise<ImportResult> {
  if (process.env.NODE_ENV !== "development") {
    return { status: "error", message: "Rekad import only runs in local development (npm run dev)." };
  }
  try {
    return await checkAndImportNextLesson();
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

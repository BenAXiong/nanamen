"use server";

import { saveSentenceEdits, savePairTags, type SaveResult } from "@/lib/rekadImport.server";

// Dev-only, same reasoning as app/import/actions.ts: never lets these write
// paths run in a deployed/production build.
function devGate(): SaveResult | null {
  if (process.env.NODE_ENV === "development") return null;
  return { status: "error", message: "Editing only runs in local development (npm run dev)." };
}

export async function saveTextEdits(edits: { id: string; amis: string; zh: string }[]): Promise<SaveResult> {
  const blocked = devGate();
  if (blocked) return blocked;
  try {
    return await saveSentenceEdits(edits);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

export async function savePairTagEdits(
  edits: { id: string; pairTag: string | null }[],
): Promise<SaveResult> {
  const blocked = devGate();
  if (blocked) return blocked;
  try {
    return await savePairTags(edits);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

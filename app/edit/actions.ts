"use server";

import { saveSentenceEdits, savePairTags, type SaveResult } from "@/lib/rekadImport.server";

// No dev-only gate here (and no auth) -- this needs to work from a deployed
// production build so Ben can edit content from his phone while away. The
// URL itself is the only protection; that's a deliberate accepted tradeoff.

export async function saveTextEdits(edits: { id: string; amis: string; zh: string }[]): Promise<SaveResult> {
  try {
    return await saveSentenceEdits(edits);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

export async function savePairTagEdits(
  edits: { id: string; pairTag: string | null }[],
): Promise<SaveResult> {
  try {
    return await savePairTags(edits);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

"use server";

import {
  saveSentenceEdits,
  savePairTags,
  insertSentence,
  deleteSentence,
  type SaveResult,
  type InsertResult,
} from "@/lib/rekadImport.server";

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

export async function insertSentenceAction(
  lessonNumber: number,
  position: number,
  amis: string,
  zh: string,
  audioUrl?: string,
): Promise<InsertResult> {
  try {
    return await insertSentence(lessonNumber, position, amis, zh, audioUrl);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteSentenceAction(id: string): Promise<SaveResult> {
  try {
    return await deleteSentence(id);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

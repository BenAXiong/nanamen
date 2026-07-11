"use server";

import { syncContent } from "@/scripts/sync-content.mjs";

export type SyncResult = { status: "ok"; message: string } | { status: "error"; message: string };

// No auth gate -- the URL itself is the only protection (accepted tradeoff).
//
// Locally (npm run dev / npm run start), CONTENT_DEPLOY_HOOK_URL is unset,
// so this writes content/generated/sentences.json + public/audio directly --
// same as the predev/prebuild hook, just on demand.
//
// On Vercel, a deployment's filesystem is read-only at runtime, so writing
// directly isn't possible there -- CONTENT_DEPLOY_HOOK_URL being set switches
// this to POSTing a Vercel Deploy Hook instead, which starts a real rebuild
// (reruns prebuild's sync-content.mjs, ~1-3 min, not instant) and is the only
// way to get Airtable edits into a deployed build (see DEC-CONTENT01).
export async function resyncContent(): Promise<SyncResult> {
  const hookUrl = process.env.CONTENT_DEPLOY_HOOK_URL;
  if (hookUrl) {
    try {
      const res = await fetch(hookUrl, { method: "POST" });
      if (!res.ok) throw new Error(`Deploy hook responded ${res.status}`);
      return { status: "ok", message: "Redeploy triggered — new content live in ~1-3 min." };
    } catch (err) {
      return { status: "error", message: err instanceof Error ? err.message : String(err) };
    }
  }

  try {
    await syncContent();
    return { status: "ok", message: "Content synced." };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

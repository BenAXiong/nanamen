import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import lessonsDataStatic from "@/content/generated/sentences.json";
import type { Lesson } from "@/lib/content";

const GENERATED_PATH = path.join(process.cwd(), "content", "generated", "sentences.json");

// Production reads the bundled snapshot (a plain static import, resolved once
// at build time -- see DEC-CONTENT01). In dev, app/layout.tsx re-syncs this
// file from Airtable on every navigation, so read it fresh off disk each call
// instead of the stale module-level import.
function loadLessons(): Lesson[] {
  if (process.env.NODE_ENV === "development") {
    try {
      return JSON.parse(readFileSync(GENERATED_PATH, "utf8")) as Lesson[];
    } catch {
      // Fall through to the bundled snapshot if the file is mid-write or missing.
    }
  }
  return lessonsDataStatic as Lesson[];
}

export function getLessons(): Lesson[] {
  return loadLessons();
}

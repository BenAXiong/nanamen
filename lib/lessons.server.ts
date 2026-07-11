import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import lessonsDataStatic from "@/content/generated/sentences.json";
import { getPairs, type Lesson, type Pair, type Section } from "@/lib/content";

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

export function getLesson(lessonSlug: string): Lesson | undefined {
  return loadLessons().find((lesson) => lesson.slug === lessonSlug);
}

export function getSection(
  lessonSlug: string,
  sectionSlug: string,
): { lesson: Lesson; section: Section } | undefined {
  const lesson = getLesson(lessonSlug);
  const section = lesson?.sections.find((s) => s.slug === sectionSlug);
  if (!lesson || !section) return undefined;
  return { lesson, section };
}

export function getAllPairs(): Pair[] {
  return loadLessons().flatMap((lesson) => lesson.sections.flatMap((section) => getPairs(lesson, section)));
}

export function getPairById(id: string): Pair | undefined {
  return getAllPairs().find((pair) => pair.id === id);
}

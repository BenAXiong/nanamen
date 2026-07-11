import lessonsData from "@/content/generated/sentences.json";

export type PairRole = "question" | "answer";

export type Sentence = {
  id: string;
  order: number;
  amis: string;
  zh: string;
  audioUrl: string | null;
  durationSeconds: number | null;
  pairTag: string | null;
  pairNumber: number | null;
  pairRole: PairRole | null;
};

export type Section = {
  slug: string;
  title: string;
  sentences: Sentence[];
};

export type Lesson = {
  slug: string;
  title: string;
  sections: Section[];
};

export type Pair = {
  id: string;
  lessonSlug: string;
  lessonTitle: string;
  sectionSlug: string;
  sectionTitle: string;
  number: number;
  question: Sentence;
  answer: Sentence;
};

const lessons = lessonsData as Lesson[];

export function getLessons(): Lesson[] {
  return lessons;
}

export function getLesson(lessonSlug: string): Lesson | undefined {
  return lessons.find((lesson) => lesson.slug === lessonSlug);
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

export function pairId(lessonSlug: string, sectionSlug: string, pairNumber: number): string {
  return `${lessonSlug}/${sectionSlug}/${pairNumber}`;
}

// Only sections with a well-formed 1:1 Qx/Ax pairing are included -- see
// scripts/sync-content.mjs's validatePairing, which warns (not throws) on
// incomplete pairs at sync time. Silently dropping them here keeps Fluency
// mode from choking on in-progress content.
export function getPairs(lesson: Lesson, section: Section): Pair[] {
  const byNumber = new Map<number, { question?: Sentence; answer?: Sentence }>();
  for (const sentence of section.sentences) {
    if (sentence.pairNumber === null || sentence.pairRole === null) continue;
    const entry = byNumber.get(sentence.pairNumber) ?? {};
    entry[sentence.pairRole] = sentence;
    byNumber.set(sentence.pairNumber, entry);
  }
  const pairs: Pair[] = [];
  for (const [number, entry] of [...byNumber.entries()].sort((a, b) => a[0] - b[0])) {
    if (!entry.question || !entry.answer) continue;
    pairs.push({
      id: pairId(lesson.slug, section.slug, number),
      lessonSlug: lesson.slug,
      lessonTitle: lesson.title,
      sectionSlug: section.slug,
      sectionTitle: section.title,
      number,
      question: entry.question,
      answer: entry.answer,
    });
  }
  return pairs;
}

export function getAllPairs(): Pair[] {
  return lessons.flatMap((lesson) => lesson.sections.flatMap((section) => getPairs(lesson, section)));
}

export function getPairById(id: string): Pair | undefined {
  return getAllPairs().find((pair) => pair.id === id);
}

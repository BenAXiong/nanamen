"use client";

import { useCallback, useMemo, useState } from "react";
import type { Lesson } from "@/lib/content";

// lessonSlug -> set of currently-selected sectionSlugs within that lesson.
// A lesson absent from the map (or mapped to an empty set) is fully
// deselected. Deliberately independent of which lesson's panel is currently
// expanded in the rail -- see scratch/nav-redesign-todo.md.
export type Selection = Record<string, Set<string>>;

export type LessonSelectionState = "all" | "some" | "none";

function defaultSelection(lessons: Lesson[]): Selection {
  const mostRecent = lessons[lessons.length - 1];
  return mostRecent ? { [mostRecent.slug]: new Set(mostRecent.sections.map((s) => s.slug)) } : {};
}

function allSelection(lessons: Lesson[]): Selection {
  const sel: Selection = {};
  for (const lesson of lessons) sel[lesson.slug] = new Set(lesson.sections.map((s) => s.slug));
  return sel;
}

export function useDeckSelection(lessons: Lesson[]) {
  const [selection, setSelection] = useState<Selection>(() => defaultSelection(lessons));

  // `lessons` can start empty and populate a moment later (e.g. the
  // Strengthen deck's weak-lessons list is empty until useNanamenState's
  // localStorage-backed data hydrates), in which case the lazy initializer
  // above computed its default off that empty array and would otherwise be
  // stuck with nothing selected forever. Apply the real default exactly
  // once, the first time `lessons` actually has content -- not on every
  // later change, so a deliberate "clear all" isn't silently undone.
  const [defaulted, setDefaulted] = useState(lessons.length > 0);
  if (!defaulted && lessons.length > 0) {
    setDefaulted(true);
    setSelection(defaultSelection(lessons));
  }

  const lessonState = useCallback(
    (lessonSlug: string): LessonSelectionState => {
      const lesson = lessons.find((l) => l.slug === lessonSlug);
      const set = selection[lessonSlug];
      if (!lesson || !set || set.size === 0) return "none";
      return set.size >= lesson.sections.length ? "all" : "some";
    },
    [lessons, selection],
  );

  const isSectionSelected = useCallback(
    (lessonSlug: string, sectionSlug: string) => !!selection[lessonSlug]?.has(sectionSlug),
    [selection],
  );

  const toggleSection = useCallback((lessonSlug: string, sectionSlug: string) => {
    setSelection((prev) => {
      const set = new Set(prev[lessonSlug]);
      if (set.has(sectionSlug)) set.delete(sectionSlug);
      else set.add(sectionSlug);
      return { ...prev, [lessonSlug]: set };
    });
  }, []);

  // Include/exclude the whole lesson without touching which of its sections
  // are individually on/off: toggling off clears the set, toggling on
  // (from "none") fills it, but the underlying per-section booleans are
  // exactly what a partial ("some") state already remembers.
  const toggleLesson = useCallback(
    (lessonSlug: string) => {
      const lesson = lessons.find((l) => l.slug === lessonSlug);
      if (!lesson) return;
      setSelection((prev) => {
        const set = prev[lessonSlug];
        const isOn = !!set && set.size > 0;
        return { ...prev, [lessonSlug]: isOn ? new Set() : new Set(lesson.sections.map((s) => s.slug)) };
      });
    },
    [lessons],
  );

  const selectAll = useCallback(() => setSelection(allSelection(lessons)), [lessons]);
  const clearAll = useCallback(() => setSelection({}), []);

  const selectedSectionCount = useMemo(
    () => Object.values(selection).reduce((n, set) => n + set.size, 0),
    [selection],
  );
  const selectedLessonCount = useMemo(
    () => Object.values(selection).filter((set) => set.size > 0).length,
    [selection],
  );

  return {
    selection,
    lessonState,
    isSectionSelected,
    toggleSection,
    toggleLesson,
    selectAll,
    clearAll,
    selectedSectionCount,
    selectedLessonCount,
  };
}

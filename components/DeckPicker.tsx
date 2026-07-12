"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Lesson } from "@/lib/content";
import { SentenceListClient } from "@/components/SentenceListClient";
import type { useDeckSelection } from "@/lib/useDeckSelection";

export type DeckSelectionApi = ReturnType<typeof useDeckSelection>;
export type PickerTone = "accent" | "amber";

function toggleColor(tone: PickerTone) {
  return tone === "amber" ? "bg-amber-500 border-amber-500" : "bg-accent border-accent";
}

// "Rekad 12 - 26/07/15" / "Lesson 12" -> "L12"; falls back to the first
// number found, then the raw title if a lesson name has no number at all.
function railLabel(title: string): string {
  const named = title.match(/(?:Rekad|Lesson)\s*(\d+)/i);
  if (named) return `L${named[1]}`;
  const num = title.match(/\d+/);
  return num ? `L${num[0]}` : title;
}

function Toggle({ on, onToggle, tone }: { on: boolean; onToggle: () => void; tone: PickerTone }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative h-4.5 w-7.5 shrink-0 rounded-full border-2 transition ${
        on ? toggleColor(tone) : "border-stone-300 dark:border-stone-600"
      }`}
    >
      <span
        className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all ${
          on ? "left-3.75" : "left-0.5"
        } ${on ? "" : "bg-stone-400 dark:bg-stone-500"}`}
      />
    </button>
  );
}

export function DeckPicker({
  lessons,
  deck,
  tone = "accent",
}: {
  lessons: Lesson[];
  deck: DeckSelectionApi;
  tone?: PickerTone;
}) {
  const [openLessonSlug, setOpenLessonSlug] = useState<string | null>(
    lessons[lessons.length - 1]?.slug ?? null,
  );
  const [openSectionSlug, setOpenSectionSlug] = useState<string | null>(null);
  const openLesson = lessons.find((l) => l.slug === openLessonSlug) ?? null;

  if (lessons.length === 0) {
    return <p className="py-8 text-center text-stone-500 dark:text-stone-400">Nothing here right now.</p>;
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {lessons.map((lesson) => {
          const state = deck.lessonState(lesson.slug);
          const isOpen = lesson.slug === openLessonSlug;
          return (
            <button
              key={lesson.slug}
              type="button"
              onClick={() => setOpenLessonSlug(lesson.slug)}
              className={`flex h-16 w-19 shrink-0 flex-col items-center justify-center rounded-xl border-2 text-sm font-semibold transition ${
                isOpen
                  ? tone === "amber"
                    ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                    : "border-accent bg-accent/10 text-accent"
                  : state === "none"
                    ? "border-stone-200 text-stone-400 dark:border-stone-700 dark:text-stone-500"
                    : "border-stone-300 text-stone-600 dark:border-stone-600 dark:text-stone-300"
              }`}
            >
              {railLabel(lesson.title)}
            </button>
          );
        })}
      </div>

      {openLesson ? (
        <div className="mt-2 flex flex-1 flex-col">
          <div className="flex items-center justify-between py-2">
            <span className="font-semibold text-stone-900 dark:text-stone-50">{openLesson.title}</span>
            <Toggle on={deck.lessonState(openLesson.slug) !== "none"} onToggle={() => deck.toggleLesson(openLesson.slug)} tone={tone} />
          </div>

          <div className="flex flex-col gap-1">
            {openLesson.sections.map((section) => {
              const expanded = section.slug === openSectionSlug;
              return (
                <div key={section.slug} className="border-b border-stone-100 dark:border-stone-800">
                  <div className="flex items-center gap-2 py-2">
                    <button
                      type="button"
                      onClick={() => setOpenSectionSlug(expanded ? null : section.slug)}
                      className="flex flex-1 items-center gap-1.5 text-left text-sm text-stone-700 dark:text-stone-300"
                    >
                      {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <span className="truncate">{section.title}</span>
                    </button>
                    <Toggle
                      on={deck.isSectionSelected(openLesson.slug, section.slug)}
                      onToggle={() => deck.toggleSection(openLesson.slug, section.slug)}
                      tone={tone}
                    />
                  </div>
                  {expanded ? (
                    <div className="pb-3 pl-6">
                      <SentenceListClient section={section} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

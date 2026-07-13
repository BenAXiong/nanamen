"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Circle } from "lucide-react";
import type { Lesson } from "@/lib/content";
import { SectionActionsOverlay } from "@/components/SectionActionsOverlay";
import { SentenceListClient } from "@/components/SentenceListClient";
import { getSectionStatus, sectionKey, useNanamenState, type SectionStatus } from "@/lib/state";
import type { useDeckSelection } from "@/lib/useDeckSelection";

const NEUTRAL = "text-stone-400 dark:text-stone-500";
const SECTION_LONG_PRESS_MS = 1000;

type SectionMenuTarget = {
  lessonSlug: string;
  sectionSlug: string;
  sectionTitle: string;
  sentenceIds: string[];
};

// Plain (grey) circle by default; it fills green once the section has been
// reviewed. The tick itself only appears once it's been tested -- not a
// grey placeholder beforehand.
function CompletionBadge({ status }: { status: SectionStatus | "none" }) {
  return (
    <span className="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
      <Circle className={`absolute inset-0 h-3.5 w-3.5 ${status === "none" ? NEUTRAL : "text-green-500"}`} />
      {status === "tested" ? <Check strokeWidth={3.5} className="h-2 w-2 text-green-500" /> : null}
    </span>
  );
}

// A lesson's own badge auto-activates from its sections' badges: green
// circle once every section has at least been reviewed, green tick once
// every section has been tested -- same two-part principle, one level up.
function aggregateStatus(statuses: (SectionStatus | "none")[]): SectionStatus | "none" {
  if (statuses.length === 0) return "none";
  if (statuses.every((s) => s === "tested")) return "tested";
  if (statuses.every((s) => s !== "none")) return "complete";
  return "none";
}

export type DeckSelectionApi = ReturnType<typeof useDeckSelection>;
export type PickerTone = "accent" | "amber";

function toggleColor(tone: PickerTone) {
  return tone === "amber"
    ? "bg-amber-500 border-amber-500 dark:bg-purple-500 dark:border-purple-500"
    : "bg-accent border-accent";
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
  const { state, markSectionsComplete, markSectionsTested, suspendSentences } = useNanamenState();
  const [openLessonSlug, setOpenLessonSlug] = useState<string | null>(
    lessons[lessons.length - 1]?.slug ?? null,
  );
  const [openSectionSlug, setOpenSectionSlug] = useState<string | null>(null);
  const openLesson = lessons.find((l) => l.slug === openLessonSlug) ?? null;

  // Long-press a section row for a quick-actions overlay (suspend all /
  // mark complete / mark tested), as an alternative to opening the section
  // and doing each sentence one at a time. A fired long-press suppresses
  // the row's own click (which otherwise expands/collapses it).
  const [sectionMenu, setSectionMenu] = useState<SectionMenuTarget | null>(null);
  const longPressFired = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startSectionHold = (target: SectionMenuTarget) => {
    longPressFired.current = false;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setSectionMenu(target);
    }, SECTION_LONG_PRESS_MS);
  };
  const cancelSectionHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };
  const handleSectionClick = (sectionSlug: string, expanded: boolean) => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    setOpenSectionSlug(expanded ? null : sectionSlug);
  };

  if (lessons.length === 0) {
    return <p className="py-8 text-center text-stone-500 dark:text-stone-400">Nothing here right now.</p>;
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {lessons.map((lesson) => {
          const state = deck.lessonState(lesson.slug);
          const isOpen = lesson.slug === openLessonSlug;
          const enabled = state !== "none";
          return (
            <button
              key={lesson.slug}
              type="button"
              onClick={() => setOpenLessonSlug(lesson.slug)}
              className={`flex h-16 w-19 shrink-0 flex-col items-center justify-center rounded-xl border-2 font-rail text-3xl font-bold transition ${
                isOpen
                  ? tone === "amber"
                    ? "border-amber-500 bg-amber-50 text-amber-700 dark:border-purple-500 dark:bg-purple-950/40 dark:text-purple-200"
                    : "border-accent bg-accent/10 text-accent"
                  : enabled
                    ? tone === "amber"
                      ? "border-stone-200 text-amber-600 dark:border-stone-700 dark:text-purple-300"
                      : "border-stone-200 text-accent dark:border-stone-700"
                    : "border-stone-200 text-stone-400 dark:border-stone-700 dark:text-stone-500"
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
            <span className="flex min-w-0 items-center gap-1.5">
              <CompletionBadge
                status={aggregateStatus(
                  openLesson.sections.map((s) => getSectionStatus(state, sectionKey(openLesson.slug, s.slug))),
                )}
              />
              <span className="truncate font-semibold text-stone-900 dark:text-stone-50">{openLesson.title}</span>
            </span>
            <Toggle on={deck.lessonState(openLesson.slug) !== "none"} onToggle={() => deck.toggleLesson(openLesson.slug)} tone={tone} />
          </div>

          <div className="flex flex-col gap-1">
            {openLesson.sections.map((section) => {
              const expanded = section.slug === openSectionSlug;
              const status = getSectionStatus(state, sectionKey(openLesson.slug, section.slug));
              return (
                <div key={section.slug} className="border-b border-stone-100 dark:border-stone-800">
                  <div className="flex items-center gap-2 py-2">
                    <button
                      type="button"
                      onClick={() => handleSectionClick(section.slug, expanded)}
                      onPointerDown={() =>
                        startSectionHold({
                          lessonSlug: openLesson.slug,
                          sectionSlug: section.slug,
                          sectionTitle: section.title,
                          sentenceIds: section.sentences.map((s) => s.id),
                        })
                      }
                      onPointerUp={cancelSectionHold}
                      onPointerLeave={cancelSectionHold}
                      onPointerCancel={cancelSectionHold}
                      className="flex flex-1 items-center gap-1.5 text-left text-sm text-stone-700 dark:text-stone-300"
                    >
                      {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <CompletionBadge status={status} />
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
                      <SentenceListClient lesson={openLesson} section={section} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {sectionMenu ? (
        <SectionActionsOverlay
          title={sectionMenu.sectionTitle}
          onSuspendAll={() => suspendSentences(sectionMenu.sentenceIds)}
          onMarkComplete={() => markSectionsComplete([sectionKey(sectionMenu.lessonSlug, sectionMenu.sectionSlug)])}
          onMarkTested={() => markSectionsTested([sectionKey(sectionMenu.lessonSlug, sectionMenu.sectionSlug)])}
          onClose={() => setSectionMenu(null)}
        />
      ) : null}
    </div>
  );
}

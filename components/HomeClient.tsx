"use client";

import { useMemo, useState } from "react";
import { Shuffle, X } from "lucide-react";
import { getPairs, type Lesson, type Pair } from "@/lib/content";
import { useNanamenState, isPairSuspended, isSentenceSuspended } from "@/lib/state";
import { useDeckSelection, type Selection } from "@/lib/useDeckSelection";
import { DeckPicker } from "@/components/DeckPicker";
import { ExposureClient, type ExposureItem } from "@/components/ExposureClient";
import { PairDrillClient } from "@/components/PairDrillClient";
import { ThemeToggle } from "@/components/ThemeToggle";

type ActiveScreen = "picker" | "exposure" | "test";

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function collectSentences(lessons: Lesson[], selection: Selection): ExposureItem[] {
  const items: ExposureItem[] = [];
  for (const lesson of lessons) {
    const set = selection[lesson.slug];
    if (!set || set.size === 0) continue;
    for (const section of lesson.sections) {
      if (!set.has(section.slug)) continue;
      for (const sentence of section.sentences) {
        items.push({ lessonSlug: lesson.slug, sectionSlug: section.slug, sentence });
      }
    }
  }
  return items;
}

function collectPairs(lessons: Lesson[], selection: Selection, filter?: (pair: Pair) => boolean): Pair[] {
  const pairs: Pair[] = [];
  for (const lesson of lessons) {
    const set = selection[lesson.slug];
    if (!set || set.size === 0) continue;
    for (const section of lesson.sections) {
      if (!set.has(section.slug)) continue;
      for (const pair of getPairs(lesson, section)) {
        if (!filter || filter(pair)) pairs.push(pair);
      }
    }
  }
  return pairs;
}

function BackBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      <h1 className="text-lg font-semibold text-stone-900 dark:text-stone-50">{title}</h1>
    </div>
  );
}

export function HomeClient({ lessons }: { lessons: Lesson[] }) {
  const { state, weakPairIds } = useNanamenState();
  const [strengthenMode, setStrengthenMode] = useState(false);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [screen, setScreen] = useState<ActiveScreen>("picker");
  const [sessionItems, setSessionItems] = useState<ExposureItem[]>([]);
  const [sessionPairs, setSessionPairs] = useState<Pair[]>([]);

  const weakSet = useMemo(() => new Set(weakPairIds), [weakPairIds]);

  // Weak pairs whose grade says "weak" AND aren't currently suspended -- the
  // actual actionable Strengthen pool (suspending a pair removes it from the
  // pool even if its grade record still says weak).
  const activeWeakPairs = useMemo(() => {
    const result: Pair[] = [];
    for (const lesson of lessons) {
      for (const section of lesson.sections) {
        for (const p of getPairs(lesson, section)) {
          if (weakSet.has(p.id) && !isPairSuspended(state, p)) result.push(p);
        }
      }
    }
    return result;
  }, [lessons, weakSet, state]);

  // Strengthen mode's content is narrowed to only the lessons/sections that
  // contain at least one active weak pair -- everything else is hidden, not
  // just greyed out.
  const weakLessons = useMemo(() => {
    const activeSections = new Set(activeWeakPairs.map((p) => `${p.lessonSlug}/${p.sectionSlug}`));
    return lessons
      .map((lesson) => ({
        ...lesson,
        sections: lesson.sections.filter((s) => activeSections.has(`${lesson.slug}/${s.slug}`)),
      }))
      .filter((lesson) => lesson.sections.length > 0);
  }, [lessons, activeWeakPairs]);

  const normalDeck = useDeckSelection(lessons);
  const strengthenDeck = useDeckSelection(weakLessons);

  const activeLessons = strengthenMode ? weakLessons : lessons;
  const deck = strengthenMode ? strengthenDeck : normalDeck;
  const tone = strengthenMode ? "amber" : "accent";

  const reviewItems = useMemo(
    () => collectSentences(activeLessons, deck.selection).filter((item) => !isSentenceSuspended(state, item.sentence.id)),
    [activeLessons, deck.selection, state],
  );
  const testPairs = useMemo(
    () =>
      collectPairs(activeLessons, deck.selection, strengthenMode ? (p) => weakSet.has(p.id) : undefined).filter(
        (p) => !isPairSuspended(state, p),
      ),
    [activeLessons, deck.selection, state, strengthenMode, weakSet],
  );

  const startReview = () => {
    setSessionItems(shuffleOn ? shuffled(reviewItems) : reviewItems);
    setScreen("exposure");
  };

  const startTest = () => {
    setSessionPairs(shuffleOn ? shuffled(testPairs) : testPairs);
    setScreen("test");
  };

  if (screen === "exposure") {
    return (
      <div className="flex flex-1 flex-col">
        <BackBar onBack={() => setScreen("picker")} title="Exposure" />
        <ExposureClient items={sessionItems} onFinish={() => setScreen("picker")} />
      </div>
    );
  }

  if (screen === "test") {
    return (
      <div className="flex flex-1 flex-col">
        <BackBar onBack={() => setScreen("picker")} title={strengthenMode ? "Strengthen" : "Automation"} />
        <PairDrillClient
          pairs={sessionPairs}
          emptyMessage={strengthenMode ? "No weak items right now." : "No Q/A pairs to drill in this selection."}
          completeTitle={strengthenMode ? "Nice work" : "Session complete"}
          showContext={strengthenMode || deck.selectedLessonCount > 1}
          allowMarkTested={!strengthenMode}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">Nanamen</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShuffleOn((v) => !v)}
              aria-pressed={shuffleOn}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                shuffleOn
                  ? tone === "amber"
                    ? "bg-amber-500 text-white dark:bg-purple-500"
                    : "bg-accent text-white"
                  : "text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
              }`}
              aria-label="Shuffle"
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <ThemeToggle />
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-sm text-stone-500 dark:text-stone-400">Amis · Malan</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={deck.selectAll}
              className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
            >
              全部
            </button>
            <button
              type="button"
              onClick={deck.clearAll}
              className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
            >
              清楚
            </button>
            {activeWeakPairs.length > 0 ? (
              <button
                type="button"
                onClick={() => setStrengthenMode((m) => !m)}
                className={`rounded-lg border border-purple-400 px-2.5 py-1 text-xs font-medium text-purple-700 transition active:scale-95 dark:border-purple-600 dark:text-purple-300 ${
                  strengthenMode ? "bg-purple-50 dark:bg-purple-950/40" : ""
                }`}
              >
                加强({activeWeakPairs.length})
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <DeckPicker key={strengthenMode ? "strengthen" : "normal"} lessons={activeLessons} deck={deck} tone={tone} />

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          disabled={strengthenMode || reviewItems.length === 0}
          onClick={startReview}
          className="flex-1 rounded-lg bg-accent px-3 py-3 text-center text-sm font-medium text-white transition active:scale-95 disabled:opacity-30 dark:bg-stone-100 dark:text-stone-900"
        >
          Review ({reviewItems.length})
        </button>
        <button
          type="button"
          disabled={testPairs.length === 0}
          onClick={startTest}
          className={`flex-1 rounded-lg px-3 py-3 text-center text-sm font-medium text-white transition active:scale-95 disabled:opacity-30 ${
            tone === "amber" ? "bg-amber-500 hover:bg-amber-600 dark:bg-purple-500 dark:hover:bg-purple-600" : "bg-accent"
          }`}
        >
          Test ({testPairs.length})
        </button>
      </div>
    </div>
  );
}

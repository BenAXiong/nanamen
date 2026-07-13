"use client";

import { useSyncExternalStore } from "react";
import type { Pair } from "@/lib/content";

const STORAGE_KEY = "nanamen-state";
const STREAK_TO_CLEAR = 3;

type PairGrade = {
  streak: number;
  weak: boolean;
};

// Keyed by "lessonSlug/sectionSlug". Absent = not started. "tested" implies
// "complete" too -- it's a superset, not a separate track.
export type SectionStatus = "complete" | "tested";

export type StoredState = {
  version: 1;
  pairGrades: Record<string, PairGrade>;
  suspendedSentences: string[];
  sectionStatus: Record<string, SectionStatus>;
};

const emptyState: StoredState = {
  version: 1,
  pairGrades: {},
  suspendedSentences: [],
  sectionStatus: {},
};

// --- Tiny external store over localStorage, read via useSyncExternalStore so
// SSR/hydration is handled by React itself (getServerSnapshot = emptyState)
// instead of the useEffect+setState dance, which a stricter lint rule flags
// as risking cascading renders. ---

let cachedState: StoredState = emptyState;
let initialized = false;
const listeners = new Set<() => void>();

function readFromStorage(): StoredState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState;
    return { ...emptyState, ...JSON.parse(raw) };
  } catch {
    return emptyState;
  }
}

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  cachedState = readFromStorage();
  initialized = true;
}

function subscribe(listener: () => void) {
  ensureInitialized();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): StoredState {
  ensureInitialized();
  return cachedState;
}

function getServerSnapshot(): StoredState {
  return emptyState;
}

function commit(next: StoredState) {
  cachedState = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((listener) => listener());
}

// --- Pure state transitions ---

function gradeGotIt(state: StoredState, id: string): StoredState {
  const prev = state.pairGrades[id] ?? { streak: 0, weak: false };
  const streak = Math.min(prev.streak + 1, STREAK_TO_CLEAR);
  const weak = streak >= STREAK_TO_CLEAR ? false : prev.weak;
  return { ...state, pairGrades: { ...state.pairGrades, [id]: { streak, weak } } };
}

function gradeMissed(state: StoredState, id: string): StoredState {
  return { ...state, pairGrades: { ...state.pairGrades, [id]: { streak: 0, weak: true } } };
}

function dismissWeak(state: StoredState, id: string): StoredState {
  return { ...state, pairGrades: { ...state.pairGrades, [id]: { streak: 0, weak: false } } };
}

function toggleSuspendSentence(state: StoredState, id: string): StoredState {
  const suspended = state.suspendedSentences.includes(id);
  return {
    ...state,
    suspendedSentences: suspended
      ? state.suspendedSentences.filter((s) => s !== id)
      : [...state.suspendedSentences, id],
  };
}

// Unlike toggleSuspendSentence, this always suspends (never un-suspends) --
// used for "suspend all" on a whole section, where toggling per-sentence
// would un-suspend already-suspended ones instead of leaving them alone.
function suspendSentences(state: StoredState, ids: string[]): StoredState {
  const set = new Set(state.suspendedSentences);
  for (const id of ids) set.add(id);
  return { ...state, suspendedSentences: [...set] };
}

// Marking complete never downgrades a section that's already "tested".
function markSectionsComplete(state: StoredState, keys: string[]): StoredState {
  const sectionStatus = { ...state.sectionStatus };
  for (const key of keys) {
    if (sectionStatus[key] !== "tested") sectionStatus[key] = "complete";
  }
  return { ...state, sectionStatus };
}

function markSectionsTested(state: StoredState, keys: string[]): StoredState {
  const sectionStatus = { ...state.sectionStatus };
  for (const key of keys) sectionStatus[key] = "tested";
  return { ...state, sectionStatus };
}

// --- Pure queries (take state explicitly so callers stay correctly reactive
// via useMemo/render deps, instead of closing over a possibly-stale state) ---

// Suspension is tracked per individual sentence, independent of pairing --
// suspending a pair's Q half doesn't touch its A half. Whether a *pair* is
// weak or drillable is derived from its two sentences below, not stored
// separately.
export function isPairWeak(state: StoredState, id: string): boolean {
  return !!state.pairGrades[id]?.weak;
}

export function getWeakPairIds(state: StoredState): string[] {
  return Object.keys(state.pairGrades).filter((id) => isPairWeak(state, id));
}

export function isSentenceSuspended(state: StoredState, sentenceId: string): boolean {
  return state.suspendedSentences.includes(sentenceId);
}

// A pair is suspended for drilling purposes if either half is individually
// suspended -- there's no separate pair-level suspend flag.
export function isPairSuspended(state: StoredState, pair: Pick<Pair, "question" | "answer">): boolean {
  return isSentenceSuspended(state, pair.question.id) || isSentenceSuspended(state, pair.answer.id);
}

export function sectionKey(lessonSlug: string, sectionSlug: string): string {
  return `${lessonSlug}/${sectionSlug}`;
}

export function getSectionStatus(state: StoredState, key: string): SectionStatus | "none" {
  return state.sectionStatus[key] ?? "none";
}

export function useNanamenState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    state,
    weakPairIds: getWeakPairIds(state),
    gradeGotIt: (id: string) => commit(gradeGotIt(state, id)),
    gradeMissed: (id: string) => commit(gradeMissed(state, id)),
    dismissWeak: (id: string) => commit(dismissWeak(state, id)),
    toggleSuspendSentence: (id: string) => commit(toggleSuspendSentence(state, id)),
    suspendSentences: (ids: string[]) => commit(suspendSentences(state, ids)),
    markSectionsComplete: (keys: string[]) => commit(markSectionsComplete(state, keys)),
    markSectionsTested: (keys: string[]) => commit(markSectionsTested(state, keys)),
  };
}

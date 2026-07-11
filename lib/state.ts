"use client";

import { useSyncExternalStore } from "react";
import type { Sentence } from "@/lib/content";
import { pairId } from "@/lib/content";

const STORAGE_KEY = "nanamen-state";
const STREAK_TO_CLEAR = 3;

type PairGrade = {
  streak: number;
  weak: boolean;
};

export type StoredState = {
  version: 1;
  pairGrades: Record<string, PairGrade>;
  suspendedPairs: string[];
  suspendedSentences: string[];
};

const emptyState: StoredState = {
  version: 1,
  pairGrades: {},
  suspendedPairs: [],
  suspendedSentences: [],
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

function toggleSuspendPair(state: StoredState, id: string): StoredState {
  const suspended = state.suspendedPairs.includes(id);
  return {
    ...state,
    suspendedPairs: suspended ? state.suspendedPairs.filter((p) => p !== id) : [...state.suspendedPairs, id],
  };
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

// --- Pure queries (take state explicitly so callers stay correctly reactive
// via useMemo/render deps, instead of closing over a possibly-stale state) ---

// Suspending a pair removes it from the weak pool even if its grade record
// still says "weak" -- checking suspendedPairs here means we never need to
// mutate pairGrades when suspending, and un-suspending naturally restores it.
export function isPairWeak(state: StoredState, id: string): boolean {
  return !!state.pairGrades[id]?.weak && !state.suspendedPairs.includes(id);
}

export function getWeakPairIds(state: StoredState): string[] {
  return Object.keys(state.pairGrades).filter((id) => isPairWeak(state, id));
}

export function isPairSuspended(state: StoredState, id: string): boolean {
  return state.suspendedPairs.includes(id);
}

export function isSentenceSuspended(
  state: StoredState,
  sentence: Sentence,
  lessonSlug: string,
  sectionSlug: string,
): boolean {
  if (sentence.pairNumber !== null) {
    return state.suspendedPairs.includes(pairId(lessonSlug, sectionSlug, sentence.pairNumber));
  }
  return state.suspendedSentences.includes(sentence.id);
}

export function useNanamenState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    state,
    weakPairIds: getWeakPairIds(state),
    gradeGotIt: (id: string) => commit(gradeGotIt(state, id)),
    gradeMissed: (id: string) => commit(gradeMissed(state, id)),
    dismissWeak: (id: string) => commit(dismissWeak(state, id)),
    toggleSuspendPair: (id: string) => commit(toggleSuspendPair(state, id)),
    toggleSuspendSentence: (id: string) => commit(toggleSuspendSentence(state, id)),
  };
}

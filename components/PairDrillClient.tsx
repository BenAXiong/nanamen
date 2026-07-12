"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { AudioButton } from "@/components/AudioButton";
import { useAudioPlayer } from "@/lib/useAudioPlayer";
import { useNanamenState } from "@/lib/state";
import type { Pair } from "@/lib/content";

const GAP_FLOOR_SECONDS = 2;

type Phase = "gap" | "answer";

// Generic Q/A drill: used both for a single Section's Fluency mode and for
// the cross-section Practice-weak-items drill -- the caller resolves and
// filters the pair list (by section, or by the weak-items pool).
export function PairDrillClient({
  pairs,
  emptyMessage,
  completeTitle = "Drill complete",
  showContext = false,
}: {
  pairs: Pair[];
  emptyMessage: string;
  completeTitle?: string;
  showContext?: boolean;
}) {
  const { play, isPlaying } = useAudioPlayer();
  const { gradeGotIt, gradeMissed } = useNanamenState();

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("gap");
  const [grades, setGrades] = useState<Record<string, "got" | "missed">>({});
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pair: Pair | undefined = pairs[index];

  // Each of the four texts (Q/A x amis/zh) reveals independently on its own
  // tap -- reset together whenever a new pair comes on screen.
  const [qAmisRevealed, setQAmisRevealed] = useState(false);
  const [qZhRevealed, setQZhRevealed] = useState(false);
  const [aAmisRevealed, setAAmisRevealed] = useState(false);
  const [aZhRevealed, setAZhRevealed] = useState(false);
  const [revealKey, setRevealKey] = useState(pair?.id);
  if (pair?.id !== revealKey) {
    setRevealKey(pair?.id);
    setQAmisRevealed(false);
    setQZhRevealed(false);
    setAAmisRevealed(false);
    setAZhRevealed(false);
  }

  // Question audio autoplays and the answer-reveal timer starts
  // automatically as soon as a pair is on screen -- no manual "reveal" step.
  useEffect(() => {
    if (!pair) return;
    if (pair.question.audioUrl) play(pair.question.audioUrl);
    setPhase("gap");
    const seconds = Math.max(pair.answer.durationSeconds ?? 0, GAP_FLOOR_SECONDS);
    gapTimer.current = setTimeout(() => {
      setPhase("answer");
      if (pair.answer.audioUrl) play(pair.answer.audioUrl);
    }, seconds * 1000);
    return () => {
      if (gapTimer.current) clearTimeout(gapTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair?.id]);

  const grade = (value: "got" | "missed") => {
    if (!pair) return;
    setGrades((g) => ({ ...g, [pair.id]: value }));
    if (value === "got") gradeGotIt(pair.id);
    else gradeMissed(pair.id);
  };

  const advance = () => setIndex((i) => i + 1);

  if (pairs.length === 0) {
    return <p className="py-8 text-center text-stone-500 dark:text-stone-400">{emptyMessage}</p>;
  }

  if (!pair) {
    const gotCount = Object.values(grades).filter((g) => g === "got").length;
    const missedCount = Object.values(grades).filter((g) => g === "missed").length;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-50">{completeTitle}</h2>
        <div className="flex gap-6">
          <div>
            <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{gotCount}</div>
            <div className="text-sm text-stone-500 dark:text-stone-400">Got it</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-red-500">{missedCount}</div>
            <div className="text-sm text-stone-500 dark:text-stone-400">Missed</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setGrades({});
            setIndex(0);
            setPhase("gap");
          }}
          className="rounded-lg bg-accent px-6 py-3 font-medium text-white transition active:scale-95 dark:bg-stone-100 dark:text-stone-900"
        >
          Retest
        </button>
      </div>
    );
  }

  const revealed = phase === "answer";

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between text-sm text-stone-500 dark:text-stone-400">
        <span>
          Pair {index + 1} / {pairs.length}
        </span>
        {showContext ? (
          <span className="truncate text-xs text-stone-400 dark:text-stone-600">
            {pair.lessonTitle} · {pair.sectionTitle}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="flex h-[38vh] w-full flex-col items-center justify-center gap-4 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <div>
            <p
              onClick={() => setQAmisRevealed((r) => !r)}
              className={`cursor-pointer text-2xl font-medium text-stone-900 transition-all dark:text-stone-50 ${
                qAmisRevealed ? "" : "select-none blur-sm"
              }`}
            >
              {pair.question.amis}
            </p>
            <p
              onClick={() => setQZhRevealed((r) => !r)}
              className={`mt-1 cursor-pointer text-stone-600 transition-all dark:text-stone-300 ${
                qZhRevealed ? "" : "select-none blur-sm"
              }`}
            >
              {pair.question.zh}
            </p>
          </div>
          <AudioButton url={pair.question.audioUrl} playing={isPlaying} onPlay={() => play(pair.question.audioUrl!)} />

          {phase === "gap" ? <p className="animate-pulse text-sm text-stone-400 dark:text-stone-600">Your turn…</p> : null}

          <div className="w-full border-t border-stone-200 dark:border-stone-800" />
          <div>
            <p
              onClick={() => revealed && setAAmisRevealed((r) => !r)}
              className={`text-2xl font-medium text-stone-900 transition-all dark:text-stone-50 ${
                revealed ? "cursor-pointer" : "cursor-default"
              } ${aAmisRevealed ? "" : "select-none blur-sm"}`}
            >
              {pair.answer.amis}
            </p>
            <p
              onClick={() => revealed && setAZhRevealed((r) => !r)}
              className={`mt-1 text-stone-600 transition-all dark:text-stone-300 ${
                revealed ? "cursor-pointer" : "cursor-default"
              } ${aZhRevealed ? "" : "select-none blur-sm"}`}
            >
              {pair.answer.zh}
            </p>
          </div>
          {revealed ? (
            <AudioButton url={pair.answer.audioUrl} playing={isPlaying} onPlay={() => play(pair.answer.audioUrl!)} />
          ) : null}
        </div>
      </div>

      {revealed ? (
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => grade("missed")}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-4 py-3 font-medium transition active:scale-95 ${
              grades[pair.id] === "missed"
                ? "border-red-500 bg-red-50 text-red-600 dark:bg-red-950/40"
                : "border-stone-300 text-stone-700 dark:border-stone-700 dark:text-stone-300"
            }`}
          >
            <X className="h-4 w-4" /> Missed
          </button>
          <button
            type="button"
            onClick={() => grade("got")}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-4 py-3 font-medium transition active:scale-95 ${
              grades[pair.id] === "got"
                ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40"
                : "border-stone-300 text-stone-700 dark:border-stone-700 dark:text-stone-300"
            }`}
          >
            <Check className="h-4 w-4" /> Got it
          </button>
        </div>
      ) : null}

      {revealed ? (
        <button
          type="button"
          onClick={advance}
          className="mt-4 rounded-lg bg-accent py-3 font-medium text-white transition active:scale-95 dark:bg-stone-100 dark:text-stone-900"
        >
          {index === pairs.length - 1 ? "Finish" : "Next"}
        </button>
      ) : null}
    </div>
  );
}

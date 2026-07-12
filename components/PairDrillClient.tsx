"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { AudioButton } from "@/components/AudioButton";
import { useAudioPlayer } from "@/lib/useAudioPlayer";
import { useNanamenState } from "@/lib/state";
import type { Pair } from "@/lib/content";

const GAP_FLOOR_SECONDS = 2;
const GAP_EXTRA_SECONDS = 1;

type Phase = "question" | "gap" | "answer";

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
  const [phase, setPhase] = useState<Phase>("question");
  const [grades, setGrades] = useState<Record<string, "got" | "missed">>({});
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pair: Pair | undefined = pairs[index];

  // The question's amis/zh reveal independently on their own tap, any time
  // -- unrelated to the timed answer reveal below. Reset whenever a new
  // pair comes on screen.
  const [qAmisRevealed, setQAmisRevealed] = useState(false);
  const [qZhRevealed, setQZhRevealed] = useState(false);
  const [revealKey, setRevealKey] = useState(pair?.id);
  if (pair?.id !== revealKey) {
    setRevealKey(pair?.id);
    setQAmisRevealed(false);
    setQZhRevealed(false);
  }

  // Question audio autoplays as soon as a pair is on screen. The gap timer
  // (silence window standing in for "your turn to answer") only starts once
  // that audio actually finishes, not alongside it -- otherwise the "your
  // turn" window overlaps with still hearing the question. Once the timer
  // elapses, the answer reveals -- its audio does NOT autoplay, the user
  // taps to hear it like any other audio button.
  useEffect(() => {
    if (!pair) return;
    setPhase("question");

    const startGap = () => {
      setPhase("gap");
      const seconds = Math.max(pair.answer.durationSeconds ?? 0, GAP_FLOOR_SECONDS) + GAP_EXTRA_SECONDS;
      gapTimer.current = setTimeout(() => setPhase("answer"), seconds * 1000);
    };

    if (pair.question.audioUrl) {
      play(pair.question.audioUrl, startGap);
    } else {
      startGap();
    }

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
            setPhase("question");
          }}
          className="rounded-lg bg-accent px-6 py-3 font-medium text-white transition active:scale-95 dark:bg-stone-100 dark:text-stone-900"
        >
          Retest
        </button>
      </div>
    );
  }

  const revealed = phase === "answer";
  const graded = !!grades[pair.id];
  // Once the answer is revealed, the question stops being peek-on-tap and
  // is just shown too, regardless of whether it was individually tapped.
  const qAmisShown = qAmisRevealed || revealed;
  const qZhShown = qZhRevealed || revealed;

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
        <div className="flex min-h-[38vh] w-full flex-col items-center justify-center gap-4 rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <div>
            <p
              onClick={() => setQAmisRevealed((r) => !r)}
              className={`cursor-pointer text-2xl font-medium text-stone-900 transition-all dark:text-stone-50 ${
                qAmisShown ? "" : "select-none blur-sm"
              }`}
            >
              {pair.question.amis}
            </p>
            <p
              onClick={() => setQZhRevealed((r) => !r)}
              className={`mt-1 cursor-pointer text-stone-600 transition-all dark:text-stone-300 ${
                qZhShown ? "" : "select-none blur-sm"
              }`}
            >
              {pair.question.zh}
            </p>
          </div>
          <AudioButton url={pair.question.audioUrl} playing={isPlaying} onPlay={() => play(pair.question.audioUrl!)} />

          <div className="w-full border-t border-stone-200 dark:border-stone-800" />

          {/* Answer: always mounted (blurred text + invisible audio button)
              so its space is reserved and nothing jiggles when it reveals.
              During the gap, an overlay covers it instead of the plain
              blurred text peeking through. */}
          <div className="relative flex w-full flex-col items-center gap-4">
            <div>
              <p className={`text-2xl font-medium text-stone-900 transition-all dark:text-stone-50 ${revealed ? "" : "select-none blur-sm"}`}>
                {pair.answer.amis}
              </p>
              <p className={`mt-1 text-stone-600 transition-all dark:text-stone-300 ${revealed ? "" : "select-none blur-sm"}`}>
                {pair.answer.zh}
              </p>
            </div>
            <div className={revealed ? "" : "invisible"}>
              <AudioButton url={pair.answer.audioUrl} playing={isPlaying} onPlay={() => play(pair.answer.audioUrl!)} />
            </div>

            {phase === "gap" ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/85 backdrop-blur-sm dark:bg-stone-900/85">
                <span className="animate-pulse rounded-full bg-stone-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-stone-100 dark:text-stone-900">
                  Answer…
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {revealed ? (
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => grade("missed")}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-4 py-3 font-medium text-red-600 transition active:scale-95 dark:text-red-400 ${
              grades[pair.id] === "missed"
                ? "border-red-500 bg-red-50 dark:bg-red-950/40"
                : "border-red-200 dark:border-red-900"
            }`}
          >
            <X className="h-4 w-4" /> Missed
          </button>
          <button
            type="button"
            onClick={() => grade("got")}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-4 py-3 font-medium text-emerald-600 transition active:scale-95 dark:text-emerald-400 ${
              grades[pair.id] === "got"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                : "border-emerald-200 dark:border-emerald-900"
            }`}
          >
            <Check className="h-4 w-4" /> Got it
          </button>
        </div>
      ) : null}

      {revealed ? (
        <button
          type="button"
          disabled={!graded}
          onClick={advance}
          className="mt-4 rounded-lg bg-accent py-3 font-medium text-white transition active:scale-95 disabled:opacity-30 dark:bg-stone-100 dark:text-stone-900"
        >
          {index === pairs.length - 1 ? "Finish" : "Next"}
        </button>
      ) : null}
    </div>
  );
}

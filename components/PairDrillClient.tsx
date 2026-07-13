"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, EyeOff, Volume2, X } from "lucide-react";
import { useAudioPlayer } from "@/lib/useAudioPlayer";
import { sectionKey, useNanamenState } from "@/lib/state";
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
  allowMarkTested = false,
  onFinish,
}: {
  pairs: Pair[];
  emptyMessage: string;
  completeTitle?: string;
  showContext?: boolean;
  // A Strengthen run only drills a section's weak subset, not its full pair
  // set -- marking "tested" off the back of that would overstate what
  // actually got tested, so callers only pass this for a regular full run.
  allowMarkTested?: boolean;
  onFinish: () => void;
}) {
  const { play, isPlaying } = useAudioPlayer();
  const { gradeGotIt, gradeMissed, markSectionsTested } = useNanamenState();

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("question");
  const [grades, setGrades] = useState<Record<string, "got" | "missed">>({});
  const [tested, setTested] = useState(false);
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sectionKeys = useMemo(
    () => [...new Set(pairs.map((p) => sectionKey(p.lessonSlug, p.sectionSlug)))],
    [pairs],
  );

  const pair: Pair | undefined = pairs[index];

  // The question's amis/zh reveal independently on their own tap, any time
  // -- unrelated to the timed answer reveal below. Reset whenever a new
  // pair comes on screen, along with `phase` -- folded into the same
  // render-time check rather than a `setPhase("question")` at the top of
  // the effect below, which a stricter lint rule flags as a synchronous
  // setState-in-effect risking a cascading render.
  const [qAmisRevealed, setQAmisRevealed] = useState(false);
  const [qZhRevealed, setQZhRevealed] = useState(false);

  // Session-wide override: unblurs the question's Amis on every pair
  // regardless of its own tap state. Local to this component instance, same
  // as ExposureClient's equivalent toggle -- not reset per pair.
  const [amisAlwaysVisible, setAmisAlwaysVisible] = useState(false);

  const [revealKey, setRevealKey] = useState(pair?.id);
  if (pair?.id !== revealKey) {
    setRevealKey(pair?.id);
    setQAmisRevealed(false);
    setQZhRevealed(false);
    setPhase("question");
  }

  // Question audio autoplays as soon as a pair is on screen. The gap timer
  // (silence window standing in for "your turn to answer") only starts once
  // that audio actually finishes, not alongside it -- otherwise the "your
  // turn" window overlaps with still hearing the question. Once the timer
  // elapses, the answer reveals -- its audio does NOT autoplay, the user
  // taps to hear it like any other audio button.
  useEffect(() => {
    if (!pair) return;

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
        {allowMarkTested ? (
          <button
            type="button"
            disabled={tested}
            onClick={() => {
              markSectionsTested(sectionKeys);
              setTested(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-green-300 px-6 py-3 font-medium text-green-700 transition active:scale-95 disabled:opacity-60 dark:border-green-800 dark:text-green-400"
          >
            <Check className="h-4 w-4" />
            {tested ? "Marked tested" : `Mark section${sectionKeys.length === 1 ? "" : "s"} as tested`}
          </button>
        ) : null}
        <div className="flex gap-3">
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
          <button
            type="button"
            onClick={onFinish}
            className="rounded-lg border border-stone-300 px-6 py-3 font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
          >
            Home
          </button>
        </div>
      </div>
    );
  }

  const revealed = phase === "answer";
  const graded = !!grades[pair.id];
  // Once the answer is revealed, the question stops being peek-on-tap and
  // is just shown too, regardless of whether it was individually tapped.
  const qAmisShown = qAmisRevealed || revealed || amisAlwaysVisible;
  const qZhShown = qZhRevealed || revealed;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between text-sm text-stone-500 dark:text-stone-400">
        <span>
          Pair {index + 1} / {pairs.length}
        </span>
        <div className="flex items-center gap-2">
          {showContext ? (
            <span className="truncate text-xs text-stone-400 dark:text-stone-600">
              {pair.lessonTitle} · {pair.sectionTitle}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setAmisAlwaysVisible((v) => !v)}
            aria-pressed={amisAlwaysVisible}
            aria-label={amisAlwaysVisible ? "Hide Amis for this session" : "Show Amis for this session"}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
              amisAlwaysVisible
                ? "bg-accent text-white dark:bg-stone-100 dark:text-stone-900"
                : "text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
            }`}
          >
            {amisAlwaysVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3">
        {/* Question bubble -- amis/zh each peek-on-tap, independent of the
            timed answer reveal below. Tapping anywhere on the bubble
            (including the text) replays its audio; a tiny icon in the
            corner pulses while it's playing. */}
        <div
          onClick={() => pair.question.audioUrl && play(pair.question.audioUrl)}
          className={`relative max-w-[78%] self-start rounded-2xl bg-stone-200 py-3 pl-5 pr-7 dark:bg-stone-700 ${
            pair.question.audioUrl ? "cursor-pointer" : ""
          }`}
        >
          <p
            onClick={() => setQAmisRevealed((r) => !r)}
            className={`text-xl font-medium text-stone-900 transition-all dark:text-stone-100 ${
              qAmisShown ? "" : "select-none blur-sm"
            }`}
          >
            {pair.question.amis}
          </p>
          <p
            onClick={() => setQZhRevealed((r) => !r)}
            className={`mt-1 text-sm text-stone-600 transition-all dark:text-stone-300 ${
              qZhShown ? "" : "select-none blur-sm"
            }`}
          >
            {pair.question.zh}
          </p>
          {pair.question.audioUrl ? (
            <Volume2
              className={`absolute bottom-2 right-2 h-3.5 w-3.5 text-stone-500 dark:text-stone-400 ${
                isPlaying ? "animate-pulse" : ""
              }`}
            />
          ) : null}
        </div>

        {/* Answer bubble: always mounted (blurred text) so its space is
            reserved and nothing jiggles when it reveals. Tapping it only
            replays audio once revealed -- before that, a tap would leak
            answer audio ahead of the timed reveal. During the gap, a
            typing-indicator overlay covers it instead of the plain blurred
            text peeking through. */}
        <div
          onClick={() => revealed && pair.answer.audioUrl && play(pair.answer.audioUrl)}
          className={`relative max-w-[78%] self-end rounded-2xl bg-violet-600 py-3 pl-5 pr-7 text-white ${
            revealed && pair.answer.audioUrl ? "cursor-pointer" : ""
          }`}
        >
          <p className={`text-xl font-medium transition-all ${revealed ? "" : "select-none blur-sm"}`}>{pair.answer.amis}</p>
          <p className={`mt-1 text-sm text-violet-100 transition-all ${revealed ? "" : "select-none blur-sm"}`}>
            {pair.answer.zh}
          </p>
          {pair.answer.audioUrl ? (
            <Volume2
              className={`absolute bottom-2 right-2 h-3.5 w-3.5 text-white/80 transition-opacity ${
                revealed ? "" : "opacity-0"
              } ${isPlaying ? "animate-pulse" : ""}`}
            />
          ) : null}

          {phase === "gap" ? (
            <div className="absolute inset-0 flex items-center gap-1.5 rounded-2xl bg-violet-600 px-5">
              <span className="h-2 w-2 animate-bounce rounded-full bg-white/70 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-white/70 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-white/70" />
            </div>
          ) : null}
        </div>
      </div>

      {/* Grade + Next controls are always mounted (hidden via `invisible`
          until revealed) so their reserved space keeps the bubbles above
          from recentering/jumping when they appear. */}
      <div className={`mt-4 flex gap-3 ${revealed ? "" : "invisible"}`}>
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

      <button
        type="button"
        disabled={!graded}
        onClick={advance}
        className={`mt-4 rounded-lg bg-accent py-3 font-medium text-white transition active:scale-95 disabled:opacity-30 dark:bg-stone-100 dark:text-stone-900 ${
          revealed ? "" : "invisible"
        }`}
      >
        {index === pairs.length - 1 ? "Finish" : "Next"}
      </button>
    </div>
  );
}

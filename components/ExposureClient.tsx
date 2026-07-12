"use client";

import { useEffect, useMemo, useState } from "react";
import { Shuffle } from "lucide-react";
import { AudioButton } from "@/components/AudioButton";
import { useAudioPlayer } from "@/lib/useAudioPlayer";
import { useNanamenState, isSentenceSuspended } from "@/lib/state";
import type { Lesson, Section } from "@/lib/content";

function shuffledIndices(length: number) {
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function ExposureClient({ lesson, section }: { lesson: Lesson; section: Section }) {
  const { play, isPlaying } = useAudioPlayer();
  const { state } = useNanamenState();

  const active = useMemo(
    () => section.sentences.filter((s) => !isSentenceSuspended(state, s, lesson.slug, section.slug)),
    [section.sentences, state, lesson.slug, section.slug],
  );

  const [order, setOrder] = useState<number[]>(() => active.map((_, i) => i));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [shuffleOn, setShuffleOn] = useState(false);

  // Reset paging when the active sentence set itself changes underneath us
  // (e.g. a suspend toggled elsewhere) -- adjusted during render rather than
  // via useEffect+setState, per https://react.dev/learn/you-might-not-need-an-effect
  const activeKey = active.map((s) => s.id).join("|");
  const [committedKey, setCommittedKey] = useState(activeKey);
  if (activeKey !== committedKey) {
    setCommittedKey(activeKey);
    setOrder(active.map((_, i) => i));
    setIndex(0);
    setRevealed(false);
    setShuffleOn(false);
  }

  const sentence = active[order[index]];

  // Autoplay is a real side effect (imperative Audio API call), so it stays
  // in an effect -- but state resets around navigation happen in the click
  // handlers below instead, so this effect never calls setState itself.
  useEffect(() => {
    if (sentence?.audioUrl) play(sentence.audioUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentence?.id]);

  if (!sentence) {
    return <p className="py-8 text-center text-stone-500 dark:text-stone-400">No sentences to review.</p>;
  }

  const goTo = (next: number) => {
    setIndex(next);
    setRevealed(false);
  };

  const toggleShuffle = () => {
    setOrder(shuffleOn ? active.map((_, i) => i) : shuffledIndices(active.length));
    setShuffleOn(!shuffleOn);
    goTo(0);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-stone-500 dark:text-stone-400">
          {index + 1} / {active.length}
        </span>
        <button
          type="button"
          onClick={toggleShuffle}
          aria-pressed={shuffleOn}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
            shuffleOn
              ? "bg-accent text-white dark:bg-stone-100 dark:text-stone-900"
              : "text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          }`}
          aria-label="Shuffle"
        >
          <Shuffle className="h-4 w-4" />
        </button>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => setRevealed((r) => !r)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setRevealed((r) => !r);
        }}
        className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-6 rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900"
      >
        <p className="text-2xl font-medium text-stone-900 dark:text-stone-50">{sentence.amis}</p>
        {revealed ? (
          <p className="text-lg text-stone-600 dark:text-stone-300">{sentence.zh}</p>
        ) : (
          <p className="text-sm text-stone-400 dark:text-stone-600">Tap to reveal</p>
        )}
        <AudioButton url={sentence.audioUrl} playing={isPlaying} onPlay={() => play(sentence.audioUrl!)} />
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => goTo(Math.max(0, index - 1))}
          className="flex-1 rounded-lg border border-stone-300 py-3 font-medium text-stone-700 transition active:scale-95 disabled:opacity-30 dark:border-stone-700 dark:text-stone-300"
        >
          Prev
        </button>
        <button
          type="button"
          disabled={index === active.length - 1}
          onClick={() => goTo(Math.min(active.length - 1, index + 1))}
          className="flex-1 rounded-lg bg-accent py-3 font-medium text-white transition active:scale-95 disabled:opacity-30 dark:bg-stone-100 dark:text-stone-900"
        >
          Next
        </button>
      </div>
    </div>
  );
}

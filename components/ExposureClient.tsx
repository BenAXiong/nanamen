"use client";

import { useEffect, useState } from "react";
import { AudioButton } from "@/components/AudioButton";
import { useAudioPlayer } from "@/lib/useAudioPlayer";
import type { Sentence } from "@/lib/content";

export type ExposureItem = { lessonSlug: string; sectionSlug: string; sentence: Sentence };

// Takes an already-assembled, already-ordered item list -- suspend
// filtering and shuffle both happen once upstream (in HomeClient) when the
// session is started, rather than live here, since this only ever renders
// as its own screen (not alongside the picker it was launched from).
export function ExposureClient({ items, onFinish }: { items: ExposureItem[]; onFinish: () => void }) {
  const { play, isPlaying } = useAudioPlayer();

  const [index, setIndex] = useState(0);
  const current = items[index];
  const sentence = current?.sentence;

  // Amis and Zh each start blurred and reveal independently on their own
  // tap -- reset together whenever a new sentence comes on screen.
  const [amisRevealed, setAmisRevealed] = useState(false);
  const [zhRevealed, setZhRevealed] = useState(false);
  const [revealKey, setRevealKey] = useState(sentence?.id);
  if (sentence?.id !== revealKey) {
    setRevealKey(sentence?.id);
    setAmisRevealed(false);
    setZhRevealed(false);
  }

  useEffect(() => {
    if (sentence?.audioUrl) play(sentence.audioUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentence?.id]);

  if (!sentence) {
    return <p className="py-8 text-center text-stone-500 dark:text-stone-400">No sentences to review.</p>;
  }

  const goTo = (next: number) => setIndex(next);

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-stone-500 dark:text-stone-400">
          {index + 1} / {items.length}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="flex h-[38vh] w-full flex-col items-center justify-center gap-6 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <p
            onClick={() => setAmisRevealed((r) => !r)}
            className={`cursor-pointer text-2xl font-medium text-stone-900 transition-all dark:text-stone-50 ${
              amisRevealed ? "" : "select-none blur-sm"
            }`}
          >
            {sentence.amis}
          </p>
          <p
            onClick={() => setZhRevealed((r) => !r)}
            className={`cursor-pointer text-lg text-stone-600 transition-all dark:text-stone-300 ${
              zhRevealed ? "" : "select-none blur-sm"
            }`}
          >
            {sentence.zh}
          </p>
          <AudioButton url={sentence.audioUrl} playing={isPlaying} onPlay={() => play(sentence.audioUrl!)} />
        </div>
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
          onClick={() => (index === items.length - 1 ? onFinish() : goTo(Math.min(items.length - 1, index + 1)))}
          className="flex-1 rounded-lg bg-accent py-3 font-medium text-white transition active:scale-95 dark:bg-stone-100 dark:text-stone-900"
        >
          {index === items.length - 1 ? "Home" : "Next"}
        </button>
      </div>
    </div>
  );
}

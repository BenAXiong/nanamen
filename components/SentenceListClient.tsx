"use client";

import { EyeOff, Eye } from "lucide-react";
import { AudioButton } from "@/components/AudioButton";
import { useAudioPlayer } from "@/lib/useAudioPlayer";
import { useNanamenState, isSentenceSuspended } from "@/lib/state";
import { pairId, type Lesson, type Section, type Sentence } from "@/lib/content";

export function SentenceListClient({ lesson, section }: { lesson: Lesson; section: Section }) {
  const { play, isPlaying } = useAudioPlayer();
  const { state, toggleSuspendPair, toggleSuspendSentence } = useNanamenState();

  const toggle = (sentence: Sentence) => {
    if (sentence.pairNumber !== null) {
      toggleSuspendPair(pairId(lesson.slug, section.slug, sentence.pairNumber));
    } else {
      toggleSuspendSentence(sentence.id);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {section.sentences.map((sentence) => {
        const suspended = isSentenceSuspended(state, sentence, lesson.slug, section.slug);
        return (
          <div
            key={sentence.id}
            className={`flex items-center gap-3 rounded-xl border p-3 transition ${
              suspended
                ? "border-stone-200 bg-stone-50 opacity-50 dark:border-stone-800 dark:bg-stone-900/50"
                : "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
            }`}
          >
            <AudioButton url={sentence.audioUrl} playing={isPlaying} onPlay={() => play(sentence.audioUrl!)} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {sentence.pairTag ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                    {sentence.pairTag}
                  </span>
                ) : null}
                <span className="truncate font-medium text-stone-900 dark:text-stone-50">{sentence.amis}</span>
              </div>
              <div className="truncate text-sm text-stone-500 dark:text-stone-400">{sentence.zh}</div>
            </div>
            <button
              type="button"
              onClick={() => toggle(sentence)}
              aria-label={suspended ? "Unsuspend" : "Suspend"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              {suspended ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { Dumbbell, EyeOff, Eye } from "lucide-react";
import { AudioButton } from "@/components/AudioButton";
import { useAudioPlayer } from "@/lib/useAudioPlayer";
import { useNanamenState, isPairWeak, isSentenceSuspended } from "@/lib/state";
import { pairId, type Lesson, type Section } from "@/lib/content";

export function SentenceListClient({ lesson, section }: { lesson: Lesson; section: Section }) {
  const { play, isPlaying } = useAudioPlayer();
  const { state, toggleSuspendSentence, gradeMissed, dismissWeak } = useNanamenState();

  return (
    <div className="flex flex-col gap-2">
      {section.sentences.map((sentence) => {
        const suspended = isSentenceSuspended(state, sentence.id);
        // Weak-item marking is per pair, not per sentence -- only sentences
        // with a Pair Tag (Q/A) have one; exposure-only sentences don't.
        const pid = sentence.pairNumber !== null ? pairId(lesson.slug, section.slug, sentence.pairNumber) : null;
        const weak = pid ? isPairWeak(state, pid) : false;
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
              <div className="font-medium text-stone-900 dark:text-stone-50">{sentence.amis}</div>
              <div className="text-sm text-stone-500 dark:text-stone-400">{sentence.zh}</div>
            </div>
            {pid ? (
              <button
                type="button"
                onClick={() => (weak ? dismissWeak(pid) : gradeMissed(pid))}
                aria-label={weak ? "Unmark pair as weak" : "Mark pair as weak"}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
                  weak
                    ? "text-amber-600 hover:bg-amber-50 dark:text-purple-400 dark:hover:bg-purple-950/40"
                    : "text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
                }`}
              >
                <Dumbbell className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => toggleSuspendSentence(sentence.id)}
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

"use client";

import { EyeOff, Eye } from "lucide-react";
import { AudioButton } from "@/components/AudioButton";
import { useAudioPlayer } from "@/lib/useAudioPlayer";
import { useNanamenState, isSentenceSuspended } from "@/lib/state";
import type { Section } from "@/lib/content";

export function SentenceListClient({ section }: { section: Section }) {
  const { play, isPlaying } = useAudioPlayer();
  const { state, toggleSuspendSentence } = useNanamenState();

  return (
    <div className="flex flex-col gap-2">
      {section.sentences.map((sentence) => {
        const suspended = isSentenceSuspended(state, sentence.id);
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
              <div className="truncate font-medium text-stone-900 dark:text-stone-50">{sentence.amis}</div>
              <div className="truncate text-sm text-stone-500 dark:text-stone-400">{sentence.zh}</div>
            </div>
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

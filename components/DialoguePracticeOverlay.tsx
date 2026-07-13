"use client";

import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";
import { dialogueTitle, splitDialogueLines } from "@/lib/dialogueFormat";

export function DialoguePracticeOverlay({
  draft,
  lessonTitle,
  audioClips,
  onClose,
}: {
  draft: string;
  lessonTitle: string;
  audioClips: Record<number, string>;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const lines = splitDialogueLines(draft);
  const hasAudio = Object.keys(audioClips).length > 0;

  // Plays one clip and resolves once it finishes (or errors/fails to
  // start), so playAll below can await it before moving to the next line --
  // native <audio> sequencing via a for-loop of promises, no extra library.
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const playClip = (i: number): Promise<void> => {
    const src = audioClips[i];
    if (!src) return Promise.resolve();
    return new Promise((resolve) => {
      setPlayingIndex(i);
      const audio = new Audio(src);
      const done = () => {
        setPlayingIndex((cur) => (cur === i ? null : cur));
        resolve();
      };
      audio.onended = done;
      audio.onerror = done;
      audio.play().catch(done);
    });
  };
  const playAll = async () => {
    for (let i = 0; i < lines.length; i++) {
      if (audioClips[i]) await playClip(i);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-stone-50 dark:bg-stone-950">
      <div className="sticky top-0 z-10 flex justify-end bg-stone-50/90 p-3 backdrop-blur-sm dark:bg-stone-950/90">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          autoFocus
          className="flex h-11 w-11 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-200 active:scale-95 dark:text-stone-400 dark:hover:bg-stone-800"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 pb-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-stone-900 dark:text-stone-50">{dialogueTitle(lessonTitle)}</h1>
          {hasAudio ? (
            <button
              type="button"
              onClick={playAll}
              className="flex shrink-0 items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95"
            >
              <Play className="h-3 w-3 fill-current" />
              Play all
            </button>
          ) : null}
        </div>
        {lines.length === 0 ? (
          <p className="py-8 text-center text-stone-500 dark:text-stone-400">Nothing to practice yet.</p>
        ) : (
          lines.map((line, i) => {
            const clickable = !!audioClips[i];
            return (
              <p
                key={i}
                onClick={clickable ? () => playClip(i) : undefined}
                className={
                  "max-w-[78%] rounded-2xl px-5 py-2 text-xl leading-relaxed transition " +
                  (clickable ? "cursor-pointer " : "") +
                  (playingIndex === i ? "ring-2 ring-offset-2 ring-offset-stone-50 dark:ring-offset-stone-950 " : "") +
                  (line.speaker === 0
                    ? "self-start bg-stone-200 text-stone-900 dark:bg-stone-700 dark:text-stone-100 ring-stone-400"
                    : "self-end bg-violet-600 text-white ring-violet-300")
                }
              >
                {line.text}
              </p>
            );
          })
        )}
      </div>
    </div>
  );
}

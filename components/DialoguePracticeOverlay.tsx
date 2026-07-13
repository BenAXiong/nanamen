"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { dialogueTitle, splitDialogueLines } from "@/lib/dialogueFormat";

export function DialoguePracticeOverlay({
  draft,
  lessonTitle,
  onClose,
}: {
  draft: string;
  lessonTitle: string;
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
        <h1 className="text-lg font-semibold text-stone-900 dark:text-stone-50">{dialogueTitle(lessonTitle)}</h1>
        {lines.length === 0 ? (
          <p className="py-8 text-center text-stone-500 dark:text-stone-400">Nothing to practice yet.</p>
        ) : (
          lines.map((line, i) => (
            <p
              key={i}
              className={
                "max-w-[78%] rounded-2xl px-5 py-2 text-xl leading-relaxed " +
                (line.speaker === 0
                  ? "self-start bg-stone-200 text-stone-900 dark:bg-stone-700 dark:text-stone-100"
                  : "self-end bg-violet-600 text-white")
              }
            >
              {line.text}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

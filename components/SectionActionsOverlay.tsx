"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function SectionActionsOverlay({
  title,
  onSuspendAll,
  onMarkComplete,
  onMarkTested,
  onClose,
}: {
  title: string;
  onSuspendAll: () => void;
  onMarkComplete: () => void;
  onMarkTested: () => void;
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

  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-lg dark:bg-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-sm font-semibold text-stone-900 dark:text-stone-50">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={run(onSuspendAll)}
            className="rounded-lg border border-stone-300 px-4 py-2 text-center text-sm font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
          >
            Suspend all
          </button>
          <button
            type="button"
            onClick={run(onMarkComplete)}
            className="rounded-lg border border-stone-300 px-4 py-2 text-center text-sm font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
          >
            Mark as complete
          </button>
          <button
            type="button"
            onClick={run(onMarkTested)}
            className="rounded-lg border border-stone-300 px-4 py-2 text-center text-sm font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
          >
            Mark as tested
          </button>
        </div>
      </div>
    </div>
  );
}

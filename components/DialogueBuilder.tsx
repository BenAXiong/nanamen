"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lesson } from "@/lib/content";

const STORAGE_KEY = "nanamen-dialogue";

function loadDraft(lessonSlug: string): string {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return "";
    return (JSON.parse(raw) as Record<string, string>)[lessonSlug] ?? "";
  } catch {
    return "";
  }
}

function saveDraft(lessonSlug: string, text: string) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    all[lessonSlug] = text;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // localStorage can be unavailable (private browsing, quota) -- the
    // draft just won't persist, not worth surfacing an error for.
  }
}

export function DialogueBuilder({ lessons }: { lessons: Lesson[] }) {
  const [lessonSlug, setLessonSlug] = useState(lessons[lessons.length - 1]?.slug ?? "");
  const lesson = lessons.find((l) => l.slug === lessonSlug) ?? null;

  const allSentences = useMemo(() => (lesson ? lesson.sections.flatMap((s) => s.sentences) : []), [lesson]);

  const [hideZh, setHideZh] = useState(false);

  // Selection resets to "everything included" whenever the lesson changes.
  const [included, setIncluded] = useState<Set<string>>(() => new Set(allSentences.map((s) => s.id)));
  const [includedForLesson, setIncludedForLesson] = useState(lessonSlug);
  if (lessonSlug !== includedForLesson) {
    setIncludedForLesson(lessonSlug);
    setIncluded(new Set(allSentences.map((s) => s.id)));
  }

  const [draft, setDraft] = useState("");

  // Load the persisted draft once we know which lesson we're on (and again
  // whenever the lesson changes) -- localStorage isn't available during SSR.
  useEffect(() => {
    setDraft(loadDraft(lessonSlug));
  }, [lessonSlug]);

  useEffect(() => {
    saveDraft(lessonSlug, draft);
  }, [lessonSlug, draft]);

  const toggle = (id: string) => {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const compose = () => {
    const text = allSentences
      .filter((s) => included.has(s.id))
      .map((s) => s.amis)
      .join("\n");
    if (draft.trim() && draft !== text) {
      const ok = window.confirm("Replace the current draft with the composed selection? This can't be undone.");
      if (!ok) return;
    }
    setDraft(text);
  };

  const exportTxt = () => {
    const blob = new Blob([draft], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dialogue-${lessonSlug}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!lesson) {
    return <p className="py-8 text-center text-stone-500 dark:text-stone-400">No lessons yet.</p>;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <h1 className="text-lg font-semibold text-stone-900 dark:text-stone-50">Dialogue builder</h1>

      <div className="flex items-center gap-3">
        <select
          value={lessonSlug}
          onChange={(e) => setLessonSlug(e.target.value)}
          className="flex-1 rounded-lg border border-stone-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
        >
          {lessons.map((l) => (
            <option key={l.slug} value={l.slug}>
              {l.title}
            </option>
          ))}
        </select>
        <label className="flex shrink-0 items-center gap-1.5 text-sm text-stone-600 dark:text-stone-300">
          <input type="checkbox" checked={hideZh} onChange={(e) => setHideZh(e.target.checked)} />
          Hide Zh
        </label>
      </div>

      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-xl border border-stone-200 p-2 dark:border-stone-800">
        {allSentences.map((sentence) => (
          <label
            key={sentence.id}
            className="flex items-start gap-2 rounded-lg p-1.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-900"
          >
            <input
              type="checkbox"
              checked={included.has(sentence.id)}
              onChange={() => toggle(sentence.id)}
              className="mt-1 shrink-0"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-stone-900 dark:text-stone-50">{sentence.amis}</span>
              {!hideZh ? <span className="block text-stone-500 dark:text-stone-400">{sentence.zh}</span> : null}
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={compose}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition active:scale-95 dark:bg-stone-100 dark:text-stone-900"
      >
        Compose ({included.size})
      </button>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={10}
        placeholder="Compose from the selection above, or just start typing…"
        className="w-full flex-1 resize-none rounded-xl border border-stone-300 p-3 text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-50"
      />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(draft)}
          className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
        >
          Copy
        </button>
        <button
          type="button"
          onClick={exportTxt}
          className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition active:scale-95 dark:bg-stone-100 dark:text-stone-900"
        >
          Export .txt
        </button>
      </div>
    </div>
  );
}

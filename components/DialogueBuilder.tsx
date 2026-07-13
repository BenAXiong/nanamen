"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Sparkles } from "lucide-react";
import type { Lesson } from "@/lib/content";
import { renderDialogueCanvas, renderDialogueHtml, splitDialogueLines } from "@/lib/dialogueFormat";
import { DialoguePracticeOverlay } from "@/components/DialoguePracticeOverlay";

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
  const [showSelection, setShowSelection] = useState(true);
  const [practicing, setPracticing] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioStatus, setAudioStatus] = useState<{ text: string; isError: boolean } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

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

  // Revoke the last generated-audio object URL on unmount so it doesn't leak.
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

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

  const exportHtml = () => {
    const html = renderDialogueHtml(splitDialogueLines(draft), lesson?.title ?? lessonSlug);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dialogue-${lessonSlug}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJpg = () => {
    const canvas = renderDialogueCanvas(splitDialogueLines(draft), lesson?.title ?? lessonSlug);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dialogue-${lessonSlug}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
      },
      "image/jpeg",
      0.92,
    );
  };

  const generateAudio = async () => {
    setAudioStatus(null);
    setIsGeneratingAudio(true);
    try {
      const res = await fetch("/api/dialogue/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: draft }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setAudioStatus({ text: body?.error ?? `Request failed (${res.status})`, isError: true });
        return;
      }
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
      setAudioStatus({ text: "Audio ready.", isError: false });
    } catch (err) {
      setAudioStatus({ text: err instanceof Error ? err.message : String(err), isError: true });
    } finally {
      setIsGeneratingAudio(false);
    }
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
          className="flex-1 rounded-lg border border-stone-300 px-2 py-1.5 text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-50"
        >
          {lessons.map((l) => (
            <option key={l.slug} value={l.slug} className="text-stone-900 dark:bg-stone-900 dark:text-stone-50">
              {l.title}
            </option>
          ))}
        </select>
        <label className="flex shrink-0 items-center gap-1.5 text-sm text-stone-600 dark:text-stone-300">
          <input type="checkbox" checked={hideZh} onChange={(e) => setHideZh(e.target.checked)} />
          Hide Zh
        </label>
      </div>

      <button
        type="button"
        onClick={() => setShowSelection((prev) => !prev)}
        className="flex shrink-0 items-center gap-1 self-start text-sm text-stone-600 dark:text-stone-300"
      >
        {showSelection ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {showSelection ? "Hide list" : "Show list"} ({included.size} selected)
      </button>

      {showSelection ? (
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
      ) : null}

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
          onClick={generateAudio}
          disabled={isGeneratingAudio}
          aria-label={isGeneratingAudio ? "Generating audio…" : "Generate audio"}
          title="Generate audio"
          className="flex aspect-square h-11 shrink-0 items-center justify-center rounded-lg border border-stone-300 text-stone-700 transition active:scale-95 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300"
        >
          <Sparkles className={`h-5 w-5 ${isGeneratingAudio ? "animate-pulse" : ""}`} />
        </button>
        <button
          type="button"
          onClick={() => setPracticing(true)}
          className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
        >
          Practice
        </button>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(draft)}
          aria-label="Copy to clipboard"
          title="Copy to clipboard"
          className="flex aspect-square h-11 shrink-0 items-center justify-center rounded-lg border border-stone-300 text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
        >
          <Copy className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={exportTxt}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition active:scale-95 dark:bg-stone-100 dark:text-stone-900"
        >
          Export .txt
        </button>
        <button
          type="button"
          onClick={exportJpg}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition active:scale-95 dark:bg-stone-100 dark:text-stone-900"
        >
          Export .jpg
        </button>
        <button
          type="button"
          onClick={exportHtml}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition active:scale-95 dark:bg-stone-100 dark:text-stone-900"
        >
          Export .html
        </button>
      </div>

      {audioStatus ? (
        <span className={`text-xs ${audioStatus.isError ? "text-red-600 dark:text-red-400" : "text-stone-500 dark:text-stone-400"}`}>
          {audioStatus.text}
        </span>
      ) : null}

      {audioUrl ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => new Audio(audioUrl).play()}
            className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
          >
            Play
          </button>
          <a
            href={audioUrl}
            download={`dialogue-${lessonSlug}.mp3`}
            className="flex-1 rounded-lg bg-accent px-4 py-2 text-center text-sm font-medium text-white transition active:scale-95 dark:bg-stone-100 dark:text-stone-900"
          >
            Download
          </a>
        </div>
      ) : null}

      {practicing ? (
        <DialoguePracticeOverlay
          draft={draft}
          lessonTitle={lesson?.title ?? lessonSlug}
          onClose={() => setPracticing(false)}
        />
      ) : null}
    </div>
  );
}

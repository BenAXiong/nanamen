"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronRight, Copy, Download, Sparkles, Upload } from "lucide-react";
import type { Lesson } from "@/lib/content";
import {
  concatenateAudioClips,
  parseImportedDialogue,
  renderDialogueCanvas,
  renderDialogueHtml,
  splitDialogueLines,
} from "@/lib/dialogueFormat";
import { DialoguePracticeOverlay } from "@/components/DialoguePracticeOverlay";

const STORAGE_KEY = "nanamen-dialogue";

// Matches the server's cap (app/api/dialogue/tts/route.ts) -- checked here
// too so a too-long line fails fast with no round trip. Individual sentences
// are always well under this, unlike a whole composed dialogue -- that's why
// generation is per-line rather than one call for the full draft.
const TTS_MAX_CHARS = 300;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Tiny external store over localStorage, read via useSyncExternalStore so
// SSR/hydration is handled by React itself (getServerSnapshot returns a
// fixed empty-object constant -- must be referentially stable across calls,
// not a fresh {} literal each time, or React logs an infinite-loop warning)
// instead of the useEffect+setState dance, which a stricter lint rule flags
// as risking cascading renders -- same pattern as lib/state.ts.
type DraftMap = Record<string, string>;
const EMPTY_DRAFTS: DraftMap = {};
let cachedDrafts: DraftMap = EMPTY_DRAFTS;
let initialized = false;
const listeners = new Set<() => void>();

function readDrafts(): DraftMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DraftMap) : {};
  } catch {
    return {};
  }
}

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  cachedDrafts = readDrafts();
  initialized = true;
}

function subscribe(listener: () => void) {
  ensureInitialized();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): DraftMap {
  ensureInitialized();
  return cachedDrafts;
}

function getServerSnapshot(): DraftMap {
  return EMPTY_DRAFTS;
}

function commitDraft(lessonSlug: string, text: string) {
  cachedDrafts = { ...cachedDrafts, [lessonSlug]: text };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedDrafts));
  } catch {
    // localStorage can be unavailable (private browsing, quota) -- the
    // draft just won't persist, not worth surfacing an error for.
  }
  listeners.forEach((listener) => listener());
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
  const [audioProgress, setAudioProgress] = useState<{ done: number; total: number } | null>(null);
  const [isDownloadingAudio, setIsDownloadingAudio] = useState(false);

  // Per-line generated audio, keyed by index into splitDialogueLines(draft)
  // -- data: URIs so the same values work for live playback (Practice
  // overlay) and get baked directly into the HTML export with no extra
  // encoding step. Stale (index-mismatched) once the draft or lesson
  // changes, so both clear it.
  const [audioClips, setAudioClips] = useState<Record<number, string>>({});
  const [audioClipsForLesson, setAudioClipsForLesson] = useState(lessonSlug);
  if (lessonSlug !== audioClipsForLesson) {
    setAudioClipsForLesson(lessonSlug);
    setAudioClips({});
  }

  // Selection resets to "everything included" whenever the lesson changes.
  const [included, setIncluded] = useState<Set<string>>(() => new Set(allSentences.map((s) => s.id)));
  const [includedForLesson, setIncludedForLesson] = useState(lessonSlug);
  if (lessonSlug !== includedForLesson) {
    setIncludedForLesson(lessonSlug);
    setIncluded(new Set(allSentences.map((s) => s.id)));
  }

  const drafts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const draft = drafts[lessonSlug] ?? "";
  const setDraft = (text: string) => {
    commitDraft(lessonSlug, text);
    setAudioClips({});
    setAudioStatus(null);
  };

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const triggerImport = () => fileInputRef.current?.click();

  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file) return;
    const parsed = parseImportedDialogue(file.name, await file.text());
    if (draft.trim() && draft !== parsed) {
      const ok = window.confirm("Replace the current draft with the imported file? This can't be undone.");
      if (!ok) return;
    }
    setDraft(parsed);
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
    const lines = splitDialogueLines(draft);
    const clipCount = lines.filter((_, i) => audioClips[i]).length;
    if (lines.length > 0 && clipCount < lines.length) {
      const message =
        clipCount === 0
          ? "No audio has been generated for this dialogue yet — export without audio?"
          : `Only ${clipCount} of ${lines.length} lines have generated audio — export anyway?`;
      if (!window.confirm(message)) return;
    }
    const html = renderDialogueHtml(lines, lesson?.title ?? lessonSlug, audioClips);
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

  // Generates one clip per line rather than one for the whole draft -- a
  // single sentence is always comfortably under TTS_MAX_CHARS, so this
  // sidesteps the length cap entirely instead of needing to chunk/stitch a
  // long draft back together. Calls are sequential (not parallel) to go
  // easy on a free, no-SLA public endpoint. Partial results are kept on a
  // mid-way failure, so whatever generated successfully is still usable.
  const generateAllAudio = async () => {
    setAudioStatus(null);
    const lines = splitDialogueLines(draft);
    if (lines.length === 0) {
      setAudioStatus({ text: "Nothing to generate audio for yet.", isError: true });
      return;
    }
    // audioClips is cleared any time the draft changes (see setDraft above),
    // so already having a clip for every current line proves nothing has
    // changed since the last successful generation -- skip re-calling the
    // endpoint entirely rather than just re-synthesizing unchanged content.
    if (lines.every((_, i) => audioClips[i])) {
      setAudioStatus({ text: "Audio is already up to date.", isError: false });
      return;
    }
    const tooLong = lines.find((l) => l.text.length > TTS_MAX_CHARS);
    if (tooLong) {
      setAudioStatus({
        text: `A line is too long for TTS (max ${TTS_MAX_CHARS} chars): "${tooLong.text.slice(0, 40)}…"`,
        isError: true,
      });
      return;
    }

    setIsGeneratingAudio(true);
    const clips: Record<number, string> = {};
    try {
      for (let i = 0; i < lines.length; i++) {
        setAudioProgress({ done: i, total: lines.length });
        const res = await fetch("/api/dialogue/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: lines[i].text }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setAudioStatus({ text: body?.error ?? `Request failed on line ${i + 1} (${res.status})`, isError: true });
          return;
        }
        clips[i] = await blobToDataUrl(await res.blob());
      }
      setAudioStatus({ text: `Generated audio for ${lines.length} line${lines.length === 1 ? "" : "s"}.`, isError: false });
    } catch (err) {
      setAudioStatus({ text: err instanceof Error ? err.message : String(err), isError: true });
    } finally {
      setAudioClips(clips);
      setAudioProgress(null);
      setIsGeneratingAudio(false);
    }
  };

  // Decodes and stitches the generated per-line clips (in line order, gaps
  // skipped) into one downloadable WAV via concatenateAudioClips -- there's
  // no single "full draft" clip from generation itself, since TTS runs per
  // sentence to stay under the length cap (see generateAllAudio above).
  const downloadFullAudio = async () => {
    const lines = splitDialogueLines(draft);
    const clips = lines.map((_, i) => audioClips[i]).filter((c): c is string => !!c);
    if (clips.length === 0) return;
    setIsDownloadingAudio(true);
    try {
      const blob = await concatenateAudioClips(clips);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dialogue-${lessonSlug}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setAudioStatus({ text: err instanceof Error ? err.message : String(err), isError: true });
    } finally {
      setIsDownloadingAudio(false);
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

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowSelection((prev) => !prev)}
          className="flex min-w-0 shrink-0 items-center gap-1 text-sm text-stone-600 dark:text-stone-300"
        >
          {showSelection ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Sentence list ({included.size} selected)
        </button>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setIncluded(new Set(allSentences.map((s) => s.id)))}
            className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setIncluded(new Set())}
            className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
          >
            None
          </button>
        </div>
      </div>

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

      <div className="flex gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.html,.htm,text/plain,text/html"
          onChange={importFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={triggerImport}
          aria-label="Import dialogue from a .txt or .html file"
          title="Import from file"
          className="flex aspect-square h-11 shrink-0 items-center justify-center rounded-lg border border-stone-300 text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
        >
          <Upload className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={compose}
          className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition active:scale-95 dark:bg-stone-100 dark:text-stone-900"
        >
          Compose ({included.size})
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
          onClick={generateAllAudio}
          disabled={isGeneratingAudio}
          aria-label={isGeneratingAudio ? "Generating audio…" : "Generate audio"}
          title="Generate audio, one clip per line"
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
          onClick={downloadFullAudio}
          disabled={isDownloadingAudio || Object.keys(audioClips).length === 0}
          aria-label="Download full audio"
          title="Download full audio (all generated lines, combined)"
          className="flex aspect-square h-11 shrink-0 items-center justify-center rounded-lg border border-stone-300 text-stone-700 transition active:scale-95 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300"
        >
          <Download className="h-5 w-5" />
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

      {audioProgress ? (
        <span className="text-xs text-stone-500 dark:text-stone-400">
          Generating audio {audioProgress.done + 1} / {audioProgress.total}…
        </span>
      ) : audioStatus ? (
        <span className={`text-xs ${audioStatus.isError ? "text-red-600 dark:text-red-400" : "text-stone-500 dark:text-stone-400"}`}>
          {audioStatus.text}
        </span>
      ) : null}

      {practicing ? (
        <DialoguePracticeOverlay
          draft={draft}
          lessonTitle={lesson?.title ?? lessonSlug}
          audioClips={audioClips}
          onClose={() => setPracticing(false)}
        />
      ) : null}
    </div>
  );
}

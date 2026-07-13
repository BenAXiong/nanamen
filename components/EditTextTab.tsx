"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { saveTextEdits, insertSentenceAction, deleteSentenceAction } from "@/app/edit/actions";
import type { LessonSentence, SaveResult } from "@/lib/rekadImport.server";

// Matches the server's cap (app/api/dialogue/tts/route.ts) -- checked here
// too so a too-long line fails fast with no round trip, same pattern as
// DialogueBuilder.
const TTS_MAX_CHARS = 300;

type EditState = Record<string, { amis: string; zh: string }>;

export function EditTextTab({ lessonNumber, sentences }: { lessonNumber: number; sentences: LessonSentence[] }) {
  const router = useRouter();
  const initial = useMemo(
    () => Object.fromEntries(sentences.map((s) => [s.id, { amis: s.amis, zh: s.zh }])),
    [sentences],
  );
  const [edits, setEdits] = useState<EditState>(initial);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const update = (id: string, patch: Partial<{ amis: string; zh: string }>) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const onSave = () => {
    const changed = sentences
      .filter((s) => edits[s.id].amis !== s.amis || edits[s.id].zh !== s.zh)
      .map((s) => ({ id: s.id, amis: edits[s.id].amis, zh: edits[s.id].zh }));
    startTransition(async () => {
      const saveResult = await saveTextEdits(changed);
      setResult(saveResult);
      if (saveResult.status === "ok") router.refresh();
    });
  };

  const onDelete = (id: string, label: string) => {
    if (!window.confirm(`Delete "${label || "this sentence"}"? This can't be undone.`)) return;
    startTransition(async () => {
      const deleteResult = await deleteSentenceAction(id);
      setResult(deleteResult);
      if (deleteResult.status === "ok") router.refresh();
    });
  };

  // --- Add sentence ---
  const [adding, setAdding] = useState(false);
  const [newAmis, setNewAmis] = useState("");
  const [newZh, setNewZh] = useState("");
  const lastOrder = sentences[sentences.length - 1]?.order ?? 0;
  const firstOrder = sentences[0]?.order ?? 1;
  const [newPosition, setNewPosition] = useState(lastOrder + 1);
  const [newAudio, setNewAudio] = useState<Blob | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Revoke the previous preview URL whenever it's replaced or the form
  // closes, so generating/regenerating audio repeatedly doesn't leak object
  // URLs for the lifetime of the page.
  const newAudioUrl = useMemo(() => (newAudio ? URL.createObjectURL(newAudio) : null), [newAudio]);
  useEffect(() => {
    return () => {
      if (newAudioUrl) URL.revokeObjectURL(newAudioUrl);
    };
  }, [newAudioUrl]);

  const resetAddForm = () => {
    setAdding(false);
    setNewAmis("");
    setNewZh("");
    setNewAudio(null);
    setAddError(null);
    setNewPosition(lastOrder + 1);
  };

  const generateAudio = async () => {
    setAddError(null);
    if (!newAmis.trim()) return;
    if (newAmis.length > TTS_MAX_CHARS) {
      setAddError(`Amis text must be under ${TTS_MAX_CHARS} characters for audio.`);
      return;
    }
    setIsGeneratingAudio(true);
    try {
      const res = await fetch("/api/dialogue/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: newAmis }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setAddError(body?.error ?? `Audio generation failed (${res.status}).`);
        return;
      }
      setNewAudio(await res.blob());
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const onInsert = () => {
    if (!newAmis.trim() || !newZh.trim()) {
      setAddError("Amis and Zh are both required.");
      return;
    }
    setAddError(null);
    startTransition(async () => {
      let audioUrl: string | undefined;
      if (newAudio) {
        const uploadRes = await fetch("/api/edit/upload-audio", { method: "POST", body: newAudio });
        const uploadBody = await uploadRes.json().catch(() => null);
        if (!uploadRes.ok) {
          setAddError(uploadBody?.error ?? "Audio upload failed.");
          return;
        }
        audioUrl = uploadBody.url;
      }
      const insertResult = await insertSentenceAction(lessonNumber, newPosition, newAmis.trim(), newZh.trim(), audioUrl);
      if (insertResult.status === "error") {
        setAddError(insertResult.message);
        return;
      }
      resetAddForm();
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-stone-700 dark:text-stone-300">Amis & Zh</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => (adding ? resetAddForm() : setAdding(true))}
            className="flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
          >
            <Plus className="h-4 w-4" />
            {adding ? "Cancel" : "Add"}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isPending}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition active:scale-95 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {result ? (
        <div
          className={`rounded-lg border p-3 text-sm ${
            result.status === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {result.status === "ok" ? `Saved ${result.updated} row(s).` : result.message}
        </div>
      ) : null}

      {adding ? (
        <div className="flex flex-col gap-2 rounded-xl border border-stone-300 p-3 dark:border-stone-700">
          <input
            type="text"
            value={newAmis}
            onChange={(e) => {
              setNewAmis(e.target.value);
              setNewAudio(null);
            }}
            placeholder="Amis"
            className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-50"
          />
          <input
            type="text"
            value={newZh}
            onChange={(e) => setNewZh(e.target.value)}
            placeholder="Zh"
            className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400"
          />

          <div className="flex items-center gap-2">
            <label className="text-xs text-stone-500 dark:text-stone-400">Position</label>
            <select
              value={newPosition}
              onChange={(e) => setNewPosition(Number(e.target.value))}
              className="min-w-0 flex-1 rounded-lg border border-stone-300 px-2 py-1.5 text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-50"
            >
              {sentences.length > 0 ? <option value={firstOrder}>At start</option> : null}
              {sentences.map((s) => (
                <option key={s.id} value={s.order + 1}>
                  After #{s.order} — {s.amis.slice(0, 24)}
                </option>
              ))}
              {sentences.length === 0 ? <option value={1}>First sentence</option> : null}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={generateAudio}
              disabled={isGeneratingAudio || !newAmis.trim()}
              className="flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition active:scale-95 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300"
            >
              <Sparkles className={`h-3.5 w-3.5 ${isGeneratingAudio ? "animate-pulse" : ""}`} />
              {isGeneratingAudio ? "Generating…" : newAudio ? "Regenerate audio" : "Generate audio"}
            </button>
            {newAudioUrl ? <audio controls src={newAudioUrl} className="h-8 flex-1" /> : null}
          </div>

          {addError ? <p className="text-xs text-red-600 dark:text-red-400">{addError}</p> : null}

          <button
            type="button"
            onClick={onInsert}
            disabled={isPending}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition active:scale-95 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
          >
            {isPending ? "Adding…" : "Insert sentence"}
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        {sentences.map((s) => (
          <div key={s.id} className="flex items-start gap-2 text-sm">
            <div className="flex w-6 shrink-0 flex-col items-center gap-1 pt-2">
              <span className="text-stone-400 dark:text-stone-600">{s.order}</span>
              <button
                type="button"
                onClick={() => onDelete(s.id, s.amis)}
                disabled={isPending}
                aria-label="Delete sentence"
                title="Delete sentence"
                className="rounded-lg p-1 text-stone-400 transition active:scale-95 disabled:opacity-50 hover:text-red-600 dark:text-stone-600 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <input
                type="text"
                value={edits[s.id]?.amis ?? ""}
                onChange={(e) => update(s.id, { amis: e.target.value })}
                className="rounded-lg border border-stone-300 px-2 py-1.5 text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-50"
              />
              <input
                type="text"
                value={edits[s.id]?.zh ?? ""}
                onChange={(e) => update(s.id, { zh: e.target.value })}
                className="rounded-lg border border-stone-300 px-2 py-1.5 text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

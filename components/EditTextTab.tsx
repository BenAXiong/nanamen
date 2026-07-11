"use client";

import { useMemo, useState, useTransition } from "react";
import { saveTextEdits } from "@/app/edit/actions";
import type { LessonSentence, SaveResult } from "@/lib/rekadImport.server";

type EditState = Record<string, { amis: string; zh: string }>;

export function EditTextTab({ sentences }: { sentences: LessonSentence[] }) {
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
      setResult(await saveTextEdits(changed));
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-stone-700 dark:text-stone-300">Amis & Zh</h2>
        <button
          type="button"
          onClick={onSave}
          disabled={isPending}
          className="rounded-lg bg-stone-900 px-4 py-1.5 text-sm font-medium text-white transition active:scale-95 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
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

      <div className="flex flex-col gap-1.5">
        {sentences.map((s) => (
          <div key={s.id} className="flex items-start gap-2 text-sm">
            <span className="w-6 shrink-0 pt-2 text-stone-400 dark:text-stone-600">{s.order}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <input
                type="text"
                value={edits[s.id]?.amis ?? ""}
                onChange={(e) => update(s.id, { amis: e.target.value })}
                className="rounded-lg border border-stone-300 px-2 py-1.5 dark:border-stone-700 dark:bg-stone-900"
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

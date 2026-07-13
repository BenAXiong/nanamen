"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePairTagEdits } from "@/app/edit/actions";
import type { LessonSentence, SaveResult } from "@/lib/rekadImport.server";
import { renderPairTagOverviewHtml } from "@/lib/pairTagHtml";

type Choice = "Q" | "A" | null;
const OPTIONS: Choice[] = ["Q", "A", null];

function parseChoice(pairTag: string | null): Choice {
  const first = pairTag?.trim()[0]?.toUpperCase();
  if (first === "Q") return "Q";
  if (first === "A") return "A";
  return null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function EditPairTagTab({
  lessonNumber,
  sentences,
}: {
  lessonNumber: number;
  sentences: LessonSentence[];
}) {
  const router = useRouter();
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(sentences.map((s) => [s.id, parseChoice(s.pairTag)])),
  );
  const [result, setResult] = useState<SaveResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isGeneratingHtml, setIsGeneratingHtml] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, LessonSentence[]>();
    for (const s of sentences) {
      const key = s.section ?? "No section";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()];
  }, [sentences]);

  // Position counter per section (numbering resets per section, matching how
  // Pair Tag works everywhere else): nth Q toggled on becomes Q{n}, nth A
  // becomes A{n}. Doesn't try to verify Q/A counts match up.
  const labels = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [, group] of groups) {
      let q = 0;
      let a = 0;
      for (const s of group) {
        const choice = choices[s.id];
        if (choice === "Q") out[s.id] = `Q${++q}`;
        else if (choice === "A") out[s.id] = `A${++a}`;
      }
    }
    return out;
  }, [groups, choices]);

  const onSave = () => {
    const edits = sentences.map((s) => ({ id: s.id, pairTag: choices[s.id] ? labels[s.id] : null }));
    startTransition(async () => {
      const saveResult = await savePairTagEdits(edits);
      setResult(saveResult);
      if (saveResult.status === "ok") router.refresh();
    });
  };

  // Uses the on-screen Q/A/none choices (not a re-fetch), so an export
  // reflects unsaved edits same as the label preview does. Every sentence
  // that already has audio in Airtable gets it baked into the export as a
  // data: URI -- fetched fresh here rather than reused across generations,
  // since the Airtable attachment URL is a short-lived signed link that may
  // have expired since the page loaded.
  const onGenerateHtml = async () => {
    setIsGeneratingHtml(true);
    try {
      const audioById = new Map<string, string>();
      await Promise.all(
        sentences.map(async (s) => {
          if (!s.audioUrl) return;
          try {
            const res = await fetch(s.audioUrl);
            if (!res.ok) return;
            audioById.set(s.id, await blobToDataUrl(await res.blob()));
          } catch {
            // Skip -- the rest of the export still proceeds without this clip.
          }
        }),
      );

      const sections = groups.map(([sectionName, group]) => ({
        name: sectionName,
        sentences: group.map((s) => ({
          amis: s.amis,
          zh: s.zh,
          choice: choices[s.id],
          audio: audioById.get(s.id) ?? null,
        })),
      }));
      const html = renderPairTagOverviewHtml(sections, lessonNumber);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lesson-${lessonNumber}-sections.html`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsGeneratingHtml(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-stone-700 dark:text-stone-300">Pair tag</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onGenerateHtml}
            disabled={isGeneratingHtml}
            className="rounded-lg border border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-700 transition active:scale-95 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300"
          >
            {isGeneratingHtml ? "Generating…" : "Generate html"}
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

      <div className="flex flex-col gap-4">
        {groups.map(([sectionName, group]) => (
          <div key={sectionName} className="flex flex-col gap-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-600">
              {sectionName}
            </h3>
            {group.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <span className="w-6 shrink-0 text-stone-400 dark:text-stone-600">{s.order}</span>
                <span className="min-w-0 flex-1 truncate text-stone-900 dark:text-stone-50">{s.amis}</span>
                <div className="flex shrink-0 gap-1">
                  {OPTIONS.map((option) => (
                    <button
                      key={option ?? "none"}
                      type="button"
                      onClick={() => setChoices((prev) => ({ ...prev, [s.id]: option }))}
                      aria-label={option ?? "None"}
                      className={`h-7 w-7 rounded-md text-xs font-medium transition ${
                        choices[s.id] === option
                          ? option === "Q"
                            ? "bg-amber-500 text-white"
                            : option === "A"
                              ? "bg-emerald-500 text-white"
                              : "bg-stone-300 text-stone-700 dark:bg-stone-700 dark:text-stone-200"
                          : "border border-stone-300 text-stone-500 dark:border-stone-700 dark:text-stone-400"
                      }`}
                    >
                      {option ?? "–"}
                    </button>
                  ))}
                </div>
                <span className="w-8 shrink-0 text-right text-xs text-stone-400 dark:text-stone-600">
                  {labels[s.id] ?? ""}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

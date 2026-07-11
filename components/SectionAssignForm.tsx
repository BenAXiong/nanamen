"use client";

import { useState, useTransition } from "react";
import { applySections } from "@/app/admin/rekad-import/actions";
import type { ApplySectionsResult, LessonSentence, ManualConfig } from "@/lib/rekadImport.server";

const SECTION_NAMES = ["Sakacecay", "Sakatosa", "Sakatolo", "Sakasepat", "Sakalima", "Sakaenem"];

type Row = { name: string; title: string; order: string };

function initialRows(config: ManualConfig | null): Row[] {
  return SECTION_NAMES.map((name) => {
    const orders = config?.sections?.[name];
    const order = Array.isArray(orders) ? orders[0] : orders;
    return {
      name,
      title: config?.sectionTitles?.[name] ?? "",
      order: order != null ? String(order) : "",
    };
  });
}

export function SectionAssignForm({
  lessonNumber,
  sentences,
  initialConfig,
}: {
  lessonNumber: number;
  sentences: LessonSentence[];
  initialConfig: ManualConfig | null;
}) {
  const [classDate, setClassDate] = useState(initialConfig?.classDate ?? "");
  const [rows, setRows] = useState<Row[]>(initialRows(initialConfig));
  const [result, setResult] = useState<ApplySectionsResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entries = rows.map((row) => ({
      name: row.name,
      title: row.title,
      order: row.order.trim() === "" ? null : Number(row.order),
    }));
    startTransition(async () => {
      setResult(await applySections(lessonNumber, classDate, entries));
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-stone-700 dark:text-stone-300">Class date (YY/MM/DD)</span>
          <input
            type="text"
            value={classDate}
            onChange={(e) => setClassDate(e.target.value)}
            placeholder="26/05/27"
            className="rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-900"
          />
        </label>

        <div className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <div key={row.name} className="grid grid-cols-[7rem_1fr_5rem] gap-2 text-sm">
              <span className="flex items-center font-medium text-stone-700 dark:text-stone-300">{row.name}</span>
              <input
                type="text"
                value={row.title}
                onChange={(e) => updateRow(i, { title: e.target.value })}
                placeholder="Section title (from the site)"
                className="rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-900"
              />
              <input
                type="number"
                value={row.order}
                onChange={(e) => updateRow(i, { order: e.target.value })}
                placeholder="Order #"
                className="rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-900"
              />
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-stone-900 px-6 py-3 font-medium text-white transition active:scale-95 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
        >
          {isPending ? "Applying…" : "Apply sections"}
        </button>
      </form>

      {result ? (
        <div
          className={`rounded-lg border p-4 text-sm ${
            result.status === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {result.status === "ok"
            ? `Applied: ${result.sectioned} section(s) set${result.renamedLesson ? ", Lesson renamed with class date" : ""}.`
            : result.message}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-stone-700 dark:text-stone-300">
          All {sentences.length} sentences (Rekad {lessonNumber})
        </h2>
        <div className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-lg border border-stone-200 dark:border-stone-800">
          {sentences.map((s) => (
            <div
              key={s.id}
              className="flex items-start gap-3 border-b border-stone-100 px-3 py-2 text-sm last:border-b-0 dark:border-stone-800"
            >
              <span className="w-8 shrink-0 text-stone-400 dark:text-stone-600">{s.order}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-stone-900 dark:text-stone-50">{s.amis}</div>
                <div className="truncate text-stone-500 dark:text-stone-400">{s.zh}</div>
              </div>
              {s.section ? (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                  {s.section}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

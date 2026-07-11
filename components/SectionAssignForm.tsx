"use client";

import { useState, useTransition } from "react";
import { applySections } from "@/app/import/actions";
import type { ApplySectionsResult, LessonSentence, ManualConfig } from "@/lib/rekadImport.server";

const SECTION_NAMES = ["Sakacecay", "Sakatosa", "Sakatolo", "Sakasepat", "Sakalima", "Sakaenem"];

// SashaWaves' own frontend bundle ships this as "DEFAULT_UNIT_SUBTITLES" --
// the same 6 thematic buckets appear to be reused across lessons (different
// sentences, same structure), so we pre-fill with these rather than making
// Ben retype them every time. Still just a default: not shown/editable in
// this compact form, but overridden by an existing config's titles if present.
const DEFAULT_SECTION_TITLES: Record<string, string> = {
  Sakacecay: "入門詞彙・基本問候",
  Sakatosa: "日常對話・家庭稱謂",
  Sakatolo: "動詞變化・否定句",
  Sakasepat: "進階句型・複合詞",
  Sakalima: "深度文化・敬語",
  Sakaenem: "文化場景・即興表達",
};

type Row = { name: string; title: string; order: string };

function initialRows(config: ManualConfig | null): Row[] {
  return SECTION_NAMES.map((name) => {
    const orders = config?.sections?.[name];
    const order = Array.isArray(orders) ? orders[0] : orders;
    return {
      name,
      title: config?.sectionTitles?.[name] ?? DEFAULT_SECTION_TITLES[name] ?? "",
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
    <div className="flex flex-col gap-3">
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-stone-700 dark:text-stone-300">
            Assign sections — Rekad {lessonNumber}
          </h2>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-stone-900 px-4 py-1.5 text-sm font-medium text-white transition active:scale-95 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
          >
            {isPending ? "Applying…" : "Apply"}
          </button>
        </div>

        <input
          type="text"
          value={classDate}
          onChange={(e) => setClassDate(e.target.value)}
          placeholder="YY/MM/DD (class date)"
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
        />

        <div className="grid grid-cols-6 gap-1.5 text-center text-xs text-stone-400 dark:text-stone-600">
          {rows.map((row, i) => (
            <span key={row.name} title={row.name} className="cursor-default">
              {i + 1}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {rows.map((row, i) => (
            <input
              key={row.name}
              type="number"
              value={row.order}
              onChange={(e) => updateRow(i, { order: e.target.value })}
              placeholder="#"
              title={row.name}
              className="w-full rounded-lg border border-stone-300 px-1 py-1.5 text-center text-sm dark:border-stone-700 dark:bg-stone-900"
            />
          ))}
        </div>
      </form>

      {result ? (
        <div
          className={`rounded-lg border p-3 text-sm ${
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

      <div className="max-h-96 overflow-y-auto rounded-lg border border-stone-200 dark:border-stone-800">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-8" />
            <col style={{ width: "60%" }} />
            <col />
          </colgroup>
          <tbody>
            {sentences.map((s) => (
              <tr key={s.id} className="border-b border-stone-100 last:border-b-0 dark:border-stone-800">
                <td className="px-2 py-1.5 text-stone-400 dark:text-stone-600">{s.order}</td>
                <td className="truncate px-2 py-1.5 text-stone-900 dark:text-stone-50">{s.amis}</td>
                <td className="truncate px-2 py-1.5 text-stone-500 dark:text-stone-400">{s.zh}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

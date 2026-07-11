"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { runRekadImport } from "@/app/import/actions";
import type { ImportResult } from "@/lib/rekadImport.server";

export function RekadImportButton() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      setResult(await runRekadImport());
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClick}
          disabled={isPending}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition active:scale-95 hover:bg-amber-600 disabled:opacity-50"
        >
          {isPending ? "Checking…" : "Check & import next lesson"}
        </button>
        <Link
          href="/edit"
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
        >
          Edit
        </Link>
      </div>

      {result ? <ResultPanel result={result} /> : null}
    </div>
  );
}

function ResultPanel({ result }: { result: ImportResult }) {
  if (result.status === "error") {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
        {result.message}
      </div>
    );
  }

  if (result.status === "unavailable") {
    return (
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
        Rekad {result.lessonNumber} isn&apos;t available on SashaWaves yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
      <p className="font-medium">Imported &ldquo;{result.lessonName}&rdquo;</p>
      <p>{result.count} sentences written.</p>
      <p>
        {result.sectioned} placed into a section, {result.unsectioned} left blank for manual sorting.
      </p>
      <p className="mt-1 text-xs opacity-80">
        {result.usedConfig
          ? `Used scratch/lesson-${result.lessonNumber}-manual-config.json.`
          : `No scratch/lesson-${result.lessonNumber}-manual-config.json found -- imported with blank sections.`}
      </p>
    </div>
  );
}

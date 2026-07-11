"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { runRekadImport } from "@/app/import/actions";
import type { ImportResult } from "@/lib/rekadImport.server";

type NonImportedResult = Exclude<ImportResult, { status: "imported" }>;

export function RekadImportButton() {
  const router = useRouter();
  const [result, setResult] = useState<NonImportedResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const importResult = await runRekadImport();
      if (importResult.status === "imported") {
        // Don't hold a stale confirmation message -- refetch so the
        // section-assignment panel (which needsSectioning now makes true for
        // this freshly-imported, all-blank lesson) shows up in its place.
        setResult(null);
        router.refresh();
      } else {
        setResult(importResult);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClick}
          disabled={isPending}
          className="flex-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition active:scale-95 hover:bg-amber-600 disabled:opacity-50"
        >
          {isPending ? "Checking…" : "Check & import next lesson"}
        </button>
        <Link
          href="/edit"
          className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-center text-sm font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
        >
          Edit
        </Link>
      </div>

      {result ? <ResultPanel result={result} /> : null}
    </div>
  );
}

// Only ever receives "error" or "unavailable" -- a successful import
// refetches instead of setting result (see onClick above), so its panel
// shows the section-assignment form in place of a confirmation message.
function ResultPanel({ result }: { result: NonImportedResult }) {
  if (result.status === "error") {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
        {result.message}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
      Rekad {result.lessonNumber} isn&apos;t available on SashaWaves yet.
    </div>
  );
}

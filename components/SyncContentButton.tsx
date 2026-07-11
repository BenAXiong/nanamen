"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resyncContent } from "@/app/actions";

export function SyncContentButton() {
  const router = useRouter();
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await resyncContent();
      setMessage({ text: result.message, isError: result.status === "error" });
      if (result.status === "ok") router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        title="Sync content from Airtable"
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition active:scale-95 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300"
      >
        {isPending ? "Syncing…" : "↻ Sync"}
      </button>
      {message ? (
        <span className={`text-xs ${message.isError ? "text-red-600 dark:text-red-400" : "text-stone-500 dark:text-stone-400"}`}>
          {message.text}
        </span>
      ) : null}
    </div>
  );
}

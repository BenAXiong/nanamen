"use client";

import { useState } from "react";
import { SectionAssignForm } from "@/components/SectionAssignForm";
import { EditTextTab } from "@/components/EditTextTab";
import { EditPairTagTab } from "@/components/EditPairTagTab";
import type { LessonSentence, ManualConfig } from "@/lib/rekadImport.server";

const TABS = [
  { key: "text", label: "Amis & Zh" },
  { key: "sections", label: "Lesson & section" },
  { key: "pairtag", label: "Pair tag" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function EditTabs({
  lessonNumber,
  sentences,
  initialConfig,
}: {
  lessonNumber: number;
  sentences: LessonSentence[];
  initialConfig: ManualConfig | null;
}) {
  const [tab, setTab] = useState<TabKey>("text");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg bg-stone-100 p-1 dark:bg-stone-900">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-50"
                : "text-stone-500 dark:text-stone-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "text" ? <EditTextTab sentences={sentences} /> : null}
      {tab === "sections" ? (
        <SectionAssignForm lessonNumber={lessonNumber} sentences={sentences} initialConfig={initialConfig} />
      ) : null}
      {tab === "pairtag" ? <EditPairTagTab sentences={sentences} /> : null}
    </div>
  );
}

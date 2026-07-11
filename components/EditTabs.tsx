"use client";

import { useMemo, useState } from "react";
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

  // Each tab derives its own local editable state from the sentences/config
  // props on mount. After any tab applies a change, EditTabs' parent Server
  // Component re-fetches (via router.refresh()) and hands down a new
  // `sentences` array -- but a plain prop change alone doesn't re-run a
  // useState initializer, so without this the other tabs would keep showing
  // stale data until a manual reload. Keying on the actual content forces a
  // clean remount (fresh local state) exactly when the underlying data
  // changed, not on every unrelated re-render.
  const dataKey = useMemo(() => JSON.stringify(sentences), [sentences]);

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

      {tab === "text" ? <EditTextTab key={dataKey} sentences={sentences} /> : null}
      {tab === "sections" ? (
        <SectionAssignForm
          key={dataKey}
          lessonNumber={lessonNumber}
          sentences={sentences}
          initialConfig={initialConfig}
          onSuccessMode="refresh"
        />
      ) : null}
      {tab === "pairtag" ? <EditPairTagTab key={dataKey} sentences={sentences} /> : null}
    </div>
  );
}

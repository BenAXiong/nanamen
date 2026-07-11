"use client";

import { useMemo } from "react";
import { useNanamenState, isPairSuspended } from "@/lib/state";
import { getPairs, type Lesson, type Section } from "@/lib/content";
import { PairDrillClient } from "@/components/PairDrillClient";

export function FluencyDrill({ lesson, section }: { lesson: Lesson; section: Section }) {
  const { state } = useNanamenState();

  const pairs = useMemo(() => {
    return getPairs(lesson, section).filter((p) => !isPairSuspended(state, p.id));
  }, [lesson, section, state]);

  return (
    <PairDrillClient
      pairs={pairs}
      emptyMessage="No Q/A pairs to drill in this section."
      completeTitle="Section complete"
    />
  );
}

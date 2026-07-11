"use client";

import { useMemo } from "react";
import { useNanamenState, isPairSuspended } from "@/lib/state";
import type { Pair } from "@/lib/content";
import { PairDrillClient } from "@/components/PairDrillClient";

export function PracticeWeakClient({ allPairs, lessonSlug }: { allPairs: Pair[]; lessonSlug?: string }) {
  const { state, weakPairIds } = useNanamenState();

  const pairs = useMemo(() => {
    const weakSet = new Set(weakPairIds);
    return allPairs.filter(
      (p) => weakSet.has(p.id) && !isPairSuspended(state, p.id) && (!lessonSlug || p.lessonSlug === lessonSlug),
    );
  }, [allPairs, weakPairIds, state, lessonSlug]);

  return (
    <PairDrillClient pairs={pairs} emptyMessage="No weak items here right now." completeTitle="Nice work" showContext />
  );
}

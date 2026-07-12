import { getLessons } from "@/lib/lessons.server";
import { Screen } from "@/components/Screen";
import { DialogueBuilder } from "@/components/DialogueBuilder";

// Hidden: reachable only by direct URL, no nav link, no auth -- same
// deliberate pattern as /edit and /import (see scratch/plan.md's
// Deployment section).
export default function DialoguePage() {
  const lessons = getLessons();

  return (
    <Screen>
      <DialogueBuilder lessons={lessons} />
    </Screen>
  );
}

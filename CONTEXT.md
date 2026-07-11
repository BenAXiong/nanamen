# Nanamen

A minimal review PWA for Amis (Malan dialect) sentences — audio, Amis text, Zh translation — organized as Language/Dialect/Lesson/Section. Two review modes: Exposure (self-paced familiarization) and Fluency (timed question/answer fluency drill).

## Language

**Sentence**:
A single unit of content: Amis text, Zh translation, and an optional audio file. Belongs to exactly one Section.
_Avoid_: Card (UI term, not a content term), Flashcard

**Section**:
The smallest content grouping a review mode operates on — a fixed set of Sentences within a Lesson. Fluency drills and Exposure browsing sessions always run within a single Section. Currently 6 per Lesson.

**Lesson**:
A collection of Sections. Currently 3 lessons exist, fixed for now (no plans to add more).

**Pair tag**:
An optional per-Sentence marker (`Q1`, `A1`, `Q2`, `A2`, ...) identifying a Sentence as the question or answer half of a question/answer pair used in Fluency mode. The numeric suffix scopes the pairing to one Section (each Section's numbering starts fresh) and pairing is strictly 1:1 — every `Qx` has exactly one matching `Ax`. Sentences with no Pair tag are exposure-only and never appear in Fluency.
_Avoid_: role, statement, none (rejected — the field is a nullable tag, not a three-way enum)

**Exposure mode**:
Self-paced review: browse a Section's Sentences (including untagged ones), Amis text as the prompt, tap to reveal Zh translation and play audio. No timer, no grading.

**Fluency mode**:
Timed question/answer fluency drill: only Sentences with a Pair tag participate. Plays a `Qx` Sentence, then practicing answering it in real time before the paired `Ax` Sentence is revealed. Trains real-time response, not passive recognition.

**Grade**:
A self-reported "Got it" / "Missed" judgment the user gives a pair right after its `Ax` is revealed during Fluency. Feeds a pair's streak toward/away from Weak item status.
_Avoid_: score (implies a computed/objective measure, not self-reported)

**Weak item**:
A Q/A pair currently included in the persisted weak-items pool. A pair enters the pool on a "Missed" grade and leaves automatically after 3 consecutive "Got it" grades, or by the user manually dismissing it. Persisted per-device (no accounts), stored globally across all Lessons/Sections.

**Practice weak items**:
A Fluency-style drill run against the current weak-items pool instead of a single Section's pairs. Scope can be narrowed to one Lesson or left as "All."

**Suspended**:
A permanent (until manually reversed) per-device exclusion of a Sentence from every mode it would otherwise appear in, including the weak-items pool — suspending a pair that's currently Weak removes it from that pool too. Suspending either half of a `Qx`/`Ax` pair suspends both, since a lone half can't be drilled. Toggled inline during review or from a Section's sentence list; suspended items stay visible there (greyed out), not hidden. Persisted in localStorage alongside Weak item state — see [DEC-AUTO01](docs/adr/DEC-AUTO01-weak-items-localstorage.md).

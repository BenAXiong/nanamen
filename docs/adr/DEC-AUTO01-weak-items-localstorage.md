# Persist Automation grades in localStorage for a weak-items pool

Initial planning called for a fully stateless app (no localStorage at all) given "no auth, a few users, keep scope minimal." During design of Automation mode, self-grading ("Got it"/"Missed" after each `Ax` reveal) turned out to only be worth doing if it produces something durable — a "list of tougher items" the user can come back and specifically drill, rather than a number that resets every session. That requirement can't be met statelessly.

**Decision**: Store per-pair grade state in localStorage, keyed globally (across all Lessons/Sections, since pair-tag numbering resets per Section). A pair enters the weak-items pool on a "Missed" grade, leaves automatically after 3 consecutive "Got it" grades, or can be manually dismissed. A "Practice weak items" drill runs against this pool (optionally scoped to one Lesson).

**Consequences**: Weak-item history is per-device, not per-person — there's no account system to sync it, consistent with the no-auth decision. This is the only client-side persistence in the app; the rest of the content (Sentences, Lessons, Sections) stays static/stateless as originally planned.

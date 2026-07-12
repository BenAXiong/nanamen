# Nav redesign implementation — Deck Picker (direction 2d)

**Status: SHIPPED.** This spec is now historical -- see `scratch/plan.md`'s
"Nav redesign -- DONE" backlog entry for what actually landed and where it
diverged (Strengthen is a header filter chip labeled 加强(N), not a
bottom-row button; suspend is per-sentence not per-pair; Automation's
reveal is a 3-phase auto flow, no manual "Reveal answer" button).

Supersedes the 4-bottom-tab IA from `nav-redesign-brief.md` with a single
home screen. Visual reference: `scratch/design/Deck Picker 2d.dc.html`
(the only CD direction being built — the other options in
`Nanamen Deck Picker Wireframes.dc.html` are exploration history, not
candidates).

## Shape

One home screen (replaces `/`, and the old Lessons/Exposure/Automation/
Strengthen tabs). No tab bar anywhere.

- Header: 全部 (select all) / 清楚 (clear) buttons + a shuffle icon toggle
  (⇄). These act **globally**, across every lesson's selection, not just
  the currently-open one.
- Horizontal lesson rail (large "L12"-style cards). Tapping a card opens
  its section list below; does not affect other lessons' selection state.
- Selected lesson's title row has its own include/exclude toggle,
  independent of the per-section toggles below it — flips the whole
  lesson in/out of the session without touching which of its sections
  are individually on/off.
- Section list for the open lesson: one row per section, each with its
  own toggle, and each **expandable on tap** to reveal that section's
  sentences (Amis / Zh / audio play button) inline — this is the reading
  job the old Lessons tab did, folded in here instead of a separate tab.
  - Each sentence row gets a **suspend/unsuspend button** in this
    expanded view (moved from the old `/l/[lesson]/[section]/list`
    route, which goes away).
- Two CTAs at the bottom: **Review** (Exposure mode) and **Test**
  (Automation/Fluency mode), scoped to everything currently
  selected/toggled on across all lessons, not just the open one.
- **Strengthen mode**: same component, recolored (distinct accent, TBD
  exact color) to signal the mode switch. Content is filtered to only
  lessons/sections that contain weak items — everything else hidden, not
  just greyed out. Review CTA is disabled (weak items only grade through
  Automation). Entering this mode auto-applies 全部 across the filtered
  content so Test works with zero taps; the user can still narrow via
  the same toggles.
- Shuffle is a single global toggle — applies to the whole session
  (everything selected across every lesson), not per-lesson.

## Data model changes

- Session content is no longer "one lesson + one section" — it's an
  arbitrary multi-lesson/multi-section selection. `ExposureClient` and
  `PairDrillClient` (Automation) need to accept a flattened list of
  sentences/pairs assembled from the selection, not a single
  `{lesson, section}` pair.
- Selection state (which lessons/sections are toggled on) needs to
  persist independent of which lesson's panel is currently expanded in
  the rail — a small client-side selection store, separate from the
  existing weak-items/suspend localStorage blob (session-only selection
  state, doesn't need to survive a reload the way weak-items/suspend do).
- Strengthen's "filtered to weak content" view needs a lookup from
  weak-item pool -> which lessons/sections currently contain at least
  one weak pair, to decide what the rail/section list shows.

## Routes affected

- `/` — becomes the new unified home screen.
- `/l/[lesson]` — removed (section grid folds into the rail + section
  list).
- `/l/[lesson]/[section]/exposure`, `/l/[lesson]/[section]/fluency` —
  replaced by session routes that take a selection rather than a single
  section (exact routing shape TBD during implementation — likely
  something like `/review` and `/test` reading selection from state
  rather than the URL, since a multi-lesson selection doesn't map
  cleanly to a path segment).
- `/l/[lesson]/[section]/list` — removed; suspend controls move into the
  expanded section view on the home screen.
- `/practice-weak` — removed; folded into the same home screen via the
  Strengthen color/filter mode.
- `/import`, `/edit` — untouched, no relation to this redesign.

## Explicitly decided (don't re-litigate)

- No tabs, no bottom nav at all.
- Weak-item dots/badges are not surfaced in the normal (non-Strengthen)
  view — matches 2d.
- Strengthen reuses the exact same picker UX (toggles, not a
  zero-config pool dump) — a deliberate simplification over the original
  brief's "no selection needed" spec, accepted in exchange for one
  shared component instead of a bespoke Strengthen screen.

# Nanamen — Amis-Malan sentence review PWA

## Context
Ben wants a minimal installable PWA for reviewing Amis (Malan dialect) sentences: Amis text + Zh translation + audio, organized as Language/Dialect/Lesson/Section (currently fixed to amis/malan, 3 lessons × 6 sections × ~50 sentences). Two modes: **Exposure** (passive familiarization) and **Fluency** (timed question/answer real-time drill). No auth, no server logic beyond reading content — scope is deliberately minimal, with two exceptions: content lives in Airtable (not a local file) so it's convenient to edit/expand, and weak-items/suspend state lives in localStorage. Deployment follows this user's established routine (GitHub + Vercel, driven by Claude, push only on explicit go-ahead — confirmed via Indivore/Echoes project memory).

Domain model, terminology, and the reasoning behind each decision below live in [`CONTEXT.md`](../../../Documents/LL/6_ycm/Opal_review/CONTEXT.md) and `docs/adr/` (produced via a grill-with-docs session) — this plan summarizes them for implementation but they're the source of truth for definitions.

Reference precedent checked: YCM_Citadel's `portal` app has a reusable audio-playback pattern (single shared `<audio>` ref + `playAudio(url)` swap-and-play, circular button with lucide `Volume2`) and a manifest-based PWA setup, but **no service worker** — offline caching needs to be added from scratch here. `豐年祭地圖`'s `api/contribute.js` shows this account's existing Airtable-proxy pattern (`AT_TOKEN`/`AT_BASE` env vars, PAT kept server-side) — Nanamen's read-only fetch is simpler (no proxy needed, Server Components can call Airtable directly at build time) but reuses the same account/workspace (`wspWL70Sr5d5qYxP0`).

## Stack
- Next.js (latest, App Router) + TypeScript + Tailwind CSS v4 — matches sibling apps' conventions
- `lucide-react` for icons (Volume2/play, check/x for grading)
- `@ducanh2912/next-pwa` for the service worker (installable + offline audio caching)
- No database, no custom backend. Content fetched from Airtable at build time (see below); weak-items/suspend state in localStorage (the only client persistence). Plain `npm`.

## Content: Airtable ([DEC-CONTENT01](../../../Documents/LL/6_ycm/Opal_review/docs/adr/DEC-CONTENT01-airtable-source-of-truth.md))
- Base **Nanamen** (`app8MvGUBu4Xg9HOR`), table **Sentences** (`tbl0IiPCsGxOZAcBL`), already created and seeded with placeholder rows. Fields: `Amis`, `Zh`, `Lesson` (single select: Lesson 1/2/3 — choice name doubles as slug source + display title), `Section` (single select: Section 1-6, same pattern, scoped in combination with Lesson), `Order` (number), `Audio` (attachment), `Pair Tag` (text, e.g. `Q1`/`A1`, blank = exposure-only).
- `scripts/sync-content.mjs` — runs as an npm `prebuild`/`predev` hook (automatic, no manual step). Fetches all rows via the Airtable REST API (`AIRTABLE_API_KEY` env var; base/table IDs hardcoded as non-secret constants, paginated fetch), **downloads each `Audio` attachment into `public/audio/<lesson-slug>/<section-slug>/...`** (Airtable's attachment URLs are signed and time-limited — confirmed via `v5.airtableusercontent.com` — so they can't be linked directly), shapes everything into `Lesson[] → Section[] → Sentence[]`, slugifies Lesson/Section choice names for URLs, validates `Qx`/`Ax` pairing per section (logs a warning, doesn't throw, on an unmatched pair or missing audio), and writes `content/generated/sentences.json`.
- `lib/content.ts` — thin loader that imports the generated JSON and exposes typed lookups (by lesson slug, section slug, pair id). The deployed app has zero runtime dependency on Airtable — only the build does.
- `content/generated/` and downloaded files under `public/audio/` are gitignored build artifacts, regenerated every build/dev-server-start.
- `AIRTABLE_API_KEY` is in `.env.local` already (git-ignored) — still needs adding to Vercel's env vars before the first real deploy.
- Seed data: the 8 test placeholder rows have been deleted now that real content exists.
- **Real Lesson 1 content is live** (2026-07-11): 56 sentences pulled from SashaWaves (`scripts/build-rekad1-import.mjs`, Malan dialect, Rekad 1, with real audio already hosted on Vercel Blob) and written directly to Airtable via the connected Airtable MCP integration. `trailingNumber()` in the sync script needed an Amis-ordinal fallback (Sakacecay etc. have no trailing digit to sort by) — see the commit "Fix section ordering for Amis-named sections."
- **Established conventions going forward** (per Ben, applied to Lesson 1): Section is left **blank** (not a placeholder bucket) for content not yet manually sorted into one of the real sections — `sync-content.mjs` silently skips blank-Section rows, they just don't appear in the app yet. Section choice names are formatted `"<Amis ordinal> - <Chinese subtitle>"` (e.g. `Sakacecay - 入門詞彙・基本問候`). `Pair Tag` gets a rough bare `Q`/`A` tag (question-mark heuristic: contains "?" → Q, else → A) rather than numbered `Qn`/`An` — consecutive same-tag rows are fine, this is real starting data for later manual numbering/pairing (not disposable "seed" data), not functional pairs yet (Fluency mode shows zero pairs until they're renumbered). Lesson names follow `"Rekad X - YY/MM/DD"` (the class date) — **applied**: Lesson 1 is now `Rekad 1 - 26/05/27`, and its URL slug changed from `/l/lesson-1/` to `/l/rekad-1-26-05-27/` accordingly (no external links existed yet, so no breakage, but future lesson renames will do this again).
- `scratch/lesson-1-manual-config.json` (tracked in git, real editable data, not a "seed" file) holds `classDate` and a flat `sections` map of section name → Order number(s) (single number or array) from `lesson-1-airtable-import.csv`. Ben edits it, then asks Claude to apply it to Airtable directly. Currently only the first entry per section is assigned (1-6); the remaining 50 sentences have a blank Section for Ben to assign via this file over time. Convention documented in `scratch/README.md` for future lessons.
- `scripts/convert-airtable-import.mjs` (generic plain-text → Airtable CSV, the CLI form of the `/conv` backlog idea) and `scripts/build-rekad1-import.mjs` (SashaWaves API → same CSV shape) both live under `npm run content:airtable-import` / `content:rekad1-import`, writing into the gitignored `scratch/` staging area.

## Routes (App Router) -- superseded by the nav redesign, see below
**Status: the 4-route drill-down IA described here was replaced by a single
unified home screen. Kept below only as history of what "before" looked
like; do not build against it. Current shape is documented under
"Nav redesign -- DONE" in the Backlog section.**

Lang/dialect layer was data-only (not a UI picker) since only amis/malan exists.

- `/` — lesson list (3 lessons) + a "Practice weak items" entry point
- `/l/[lesson]` — section grid, each linking to its exposure/fluency/list screens
- `/l/[lesson]/[section]/exposure` — Exposure mode player
- `/l/[lesson]/[section]/fluency` — Fluency mode drill
- `/l/[lesson]/[section]/list` — sentence list with per-item suspend
- `/practice-weak` — Practice weak items drill, optional `?lesson=` scope

## Exposure mode ("Review")
- Launched from the home screen's "Review" CTA, over whatever lessons/sections are currently ticked in the deck picker (see Backlog) — no longer scoped to one section at a time.
- Card: Amis (large) and Zh (smaller) each start **blurred and reveal independently on their own tap** — not a single whole-card tap, and not "Amis always visible, only Zh gated." Audio auto-plays on card show.
- Card is vertically centered in the available space (`components/ExposureClient.tsx`, `h-[38vh]`); Prev/Next buttons pinned at the bottom.
- On the last card, the "Next" button becomes "Home" and returns to the picker instead of just disabling.
- No grading, no timer, no persisted state. Suspended sentences are excluded before the session starts.

## Automation mode ("Test") -- question/answer real-time drill
Only sentences with a `Pair Tag` participate, pulled as `Qx`/`Ax` pairs across whatever's ticked in the picker (or the weak pool, in Strengthen mode — see below). Suspended pairs (either half individually suspended) are excluded.

Per-pair flow, `components/PairDrillClient.tsx`:
1. **question phase**: `Qx` audio autoplays. Its Amis/Zh each blur-and-reveal independently on tap, same interaction as Exposure, available the whole time regardless of phase. The answer's Amis/Zh/audio button are already mounted (blurred / invisible) so nothing jiggles later, but aren't tappable yet.
2. Once the question audio's `onended` fires (not in parallel with it — a real timing bug from an earlier round), the drill moves to **gap phase**: a "Answer…" overlay covers just the answer area for `max(Ax duration, 2s floor) + 1s`.
3. Timer elapses → **answer phase**: overlay drops, the answer's Amis/Zh unblur automatically (no extra tap needed), and the question's Amis/Zh unblur too regardless of their own tap state. The answer's audio does **not** autoplay — tap it like any other audio button.
4. Missed/Got it appear below the card (permanently red/green, not just when selected). **Next/Finish is disabled until the pair is actually graded.**

End of session: summary screen with tally (Got it / Missed counts) and a **Retest** button (renamed from Restart).

## Weak items & Suspend (localStorage)
- **Weak-item pool**: keyed by pair id, globally unique. A pair enters the pool on a "Missed" grade, is removed after 3 consecutive "Got it" grades, or can be manually dismissed. Also manually toggleable directly: the expanded sentence list (in the deck picker) has a barbell icon next to the suspend eye icon, left of it, shown only for Q/A sentences — toggling it calls the same gradeMissed/dismissWeak transitions as a real grade would.
- **Suspend is per-individual-sentence**, not per-pair (changed from the original pair-unit design) — suspending a Q no longer silently suspends its A. A pair counts as suspended for drilling purposes if *either* half is individually suspended (derived at read time in `lib/state.ts`, not stored as a separate flag).
- Lives in a single localStorage blob (`nanamen-state`), no accounts, no cross-device sync — per [DEC-AUTO01](../../../Documents/LL/6_ycm/Opal_review/docs/adr/DEC-AUTO01-weak-items-localstorage.md).

## Audio playback
Reuse the pattern from `YCM_Citadel/portal/app/[language]/learn/page.tsx`: one shared `audioRef`, a `playAudio(url)` helper that pauses/swaps `src`/plays and swallows autoplay-blocked errors, circular button with lucide `Volume2`. Note: mobile browsers often block true autoplay without a prior user gesture — the first audio play in a session may require a tap; subsequent auto-plays within the same interaction chain should work. The Fluency gap timer needs `Ax` audio duration up front — computed once in `scripts/sync-content.mjs` using `music-metadata` (pure JS, no native/ffmpeg dependency, so it works unmodified in Vercel's build environment) and stored as `durationSeconds` on each Sentence in the generated JSON, rather than read at runtime from a preloaded `<audio>` element.

## Layout
Single responsive column, `max-w-md mx-auto` centered card on desktop so it doesn't stretch full-width, large tap targets, fixed bottom control bar on mobile (reveal/next/grade buttons) so the card content area stays consistent in height. Visual/layout details beyond this default are being resolved by building and reviewing actual screens, not further upfront spec.

## PWA setup
- `app/manifest.ts` (Next Metadata Route, not a static `public/manifest.json`) — name "Nanamen", `display: standalone`, theme/background color, one 512×512 maskable icon generated via `app/icon.tsx` (`next/og` `ImageResponse`, placeholder glyph — Ben can swap for a real logo later)
- `@ducanh2912/next-pwa` service worker: caches the app shell + audio files (runtime caching strategy for audio URLs) so a section can be reviewed offline once opened
- **Gotcha hit during build**: Next 16 defaults `next dev`/`next build` to Turbopack, which fatally conflicts with next-pwa's webpack-config injection (`next dev` reported "Ready" then the server never actually accepted connections). Fixed by forcing classic webpack: `"dev": "next dev --webpack"`, `"build": "next build --webpack"` in package.json. PWA is disabled in dev (`disable: process.env.NODE_ENV === "development"`) so this only matters for production builds/deploys.

## Naming
- Product name: **Nanamen**
- GitHub repo: `BenAXiong/nanamen` — DONE
- Vercel project: `nanamen`, live at `https://nanamen.vercel.app` — DONE (deployed and connected to the GitHub repo, so pushes to `master` also trigger a Vercel build)
- Mode labels shown in the UI: home-screen CTAs are **Review** (Exposure) and **Test** (Automation, the renamed Fluency). The Strengthen filter is the **加强(N)** chip in the header (Chinese, matching 全部/清楚 next to it), not an English "Strengthen" label anywhere in the UI.

## Deployment -- DONE
- `git init`, GitHub repo, `vercel link`, initial + production deploys all done.
- Vercel env vars set: `AIRTABLE_API_KEY`, `AIRTABLE_WRITE_KEY`, `SASHAWAVES_REKAD_CODE`, `CONTENT_DEPLOY_HOOK_URL` (a Vercel Deploy Hook the `/edit` page's Sync button POSTs to in production, since a deployment's filesystem is read-only at runtime — see DEC-CONTENT01).
- `/import` and `/edit` are deliberately **not dev-gated and have no auth** on the deployed site — Ben needs to edit content from his phone while away from his dev machine. This was a real back-and-forth: auth (HTTP Basic via middleware) was added once, then explicitly removed at Ben's request ("I didn't ask for auth"/"leave it open") — the URL itself is the only protection, and that's an accepted, deliberate tradeoff, not an oversight. Don't re-add auth or any other gate here without asking first.
- Commit freely during the build; push only on Ben's explicit "push" — matches the established cross-project convention.

## Explicitly out of scope for MVP
No login, no DB/backend beyond the Airtable content read, no cross-device sync, no production/recording input (speaking isn't captured, only self-graded), no multi-language UI beyond amis/malan, no analytics, no settings screen beyond what's specified above.

## Backlog (post-MVP, not yet built)

### Dark/light mode toggle -- DONE
Built: toggle on the home page header (sun/moon icon), class-based Tailwind v4 dark mode (`@custom-variant dark`), defaults to dark via a blocking pre-paint script, persisted in localStorage (`nanamen-theme`), light mode's primary actions use an Airtable-blue accent (`#2D7FF9`).

### Nav redesign -- DONE
Replaced the 4-tab IA (`nav-redesign-brief.md`) with a single unified home
screen (`components/HomeClient.tsx` + `DeckPicker.tsx`) based on Claude
Design direction 2d: lesson rail (bare `LX` labels, natural order) + a
per-lesson section list with independent lesson/section toggles, sections
expanding inline to `SentenceListClient` (Amis/Zh/audio/suspend/weak-mark)
instead of a separate route. Review/Test launch as in-page view swaps, not
navigations. 全部/清楚/加强(N)/shuffle live in the header; 加强 filters the
whole picker to weak-only content and recolors it purple, disabling Review
(Automation-only) while Test stays enabled.

Went through several real rounds of bug-fixing after Ben clicked through it
live (not just build/typecheck) -- worth remembering that pattern for future
UI work here: `lib/useDeckSelection.ts`'s default-selection initializer only
ran once, so a deck built from a list that starts empty and populates later
(the Strengthen deck, before localStorage hydrates) got permanently stuck
with nothing selected; the Automation gap timer was starting in parallel
with the question's audio instead of waiting for its `onended`; Strengthen's
Test count didn't match its own badge because it pulled every pair in a
matched section instead of just the weak ones. Full original spec (now
historical, some details superseded by the above): `scratch/nav-redesign-todo.md`.

### Revamp workflow -- DONE
Resolved by the Deck Picker / review-flow redesign above -- that was the
workflow Ben meant (how you pick content and move through Review/Test/
Strengthen), not the separate content-authoring (import/edit/sync) loop,
which remains as described in the Rekad-import section below.

### Icons: PWA, favicon, splash -- DONE
Real art: Ben dropped `Logo_barbell_1_nobg.png` (500x500, transparent) at
the repo root, now moved to `public/logo.png`. `app/icon.tsx` and the new
`app/apple-icon.tsx` both composite it onto a white background via
`ImageResponse` (`lib/logo.server.ts` reads+base64-encodes the source once,
shared by both) -- a maskable/home-screen icon shouldn't be transparent,
it gets cropped to a shape by the OS. `icon.tsx` leaves ~14% padding for
the maskable safe zone; `apple-icon.tsx` fills the frame since iOS applies
no mask of its own. `manifest.ts`'s `background_color` changed to `#ffffff`
so the Android/Chrome install splash matches. Removed the stale default
`app/favicon.ico` (untouched create-next-app placeholder) -- `icon.tsx`'s
PNG is now the sole favicon source via the auto-generated `<link>` tag.

### Add/remove sentences in `/edit`
`/edit` currently only edits existing rows (text, section, pair tag) -- no way to add a new sentence or delete one from a lesson without going into Airtable directly.

### Pair sentences in Exposure mode -- LOWEST PRIORITY, do last
Exposure mode currently lists sentences sequentially, including both halves
of a pair shown separately. Ben wants paired sentences (Qx/Ax) presented
together in Exposure -- deliberately deferred: pairing isn't strictly
dualistic (some questions have both an affirmative and a negative answer,
i.e. one question can link to more than one answer), so this needs a
real linking model, not just "show Qx then its one Ax," before it's worth
building.

### Add `/dialogue` -- DONE (as a content-authoring tool, not a review mode)
Turned out to mean something different from the original vague "new
route/mode" stub: it's a hidden authoring tool (`app/dialogue/page.tsx` +
`components/DialogueBuilder.tsx`, same no-auth/unlinked pattern as
`/edit`/`/import`), not a new review mode. Pick a lesson, optionally hide
Zh, uncheck sentences you don't want, "Compose" joins the remaining Amis
text into an editable textarea (explicit button, never auto-syncs -- warns
before overwriting a differing draft). Draft persists to localStorage per
lesson slug; Export downloads `.txt`, Copy hits the clipboard. Actually
*reviewing* a custom dialogue as a mode is still unscoped, if that's ever
wanted on top of this.

## Rekad import (SashaWaves → Airtable automation)

**Why**: Lessons 2+ come from the same SashaWaves course platform as Lesson 1. Doing the pull-and-write manually (as done for Lesson 1: fetch via a one-off CLI script, hand-build the Airtable payload, apply via Claude interactively through the Airtable MCP connection) doesn't scale — Ben wants a button in the app itself that checks for and imports the next lesson, without needing Claude in the loop or a Vercel deploy to use it.

**API investigation done during planning** (read-only calls against the real API, using Ben's token):
- `POST /api/rekad-auth` with `{code}` → short-lived bearer token.
- `GET /api/rekad-content?dialect=malan&type=sentence&stage=N` → `{vocab: [], sentences: [{id, sentence, chineseTrans, audioUrl, cultureContext, hint, level}]}`. **No section/curriculum field exists on sentences** — confirmed by inspecting the full response shape. Tried `type=section`, `/api/rekad-sections`, `/api/rekad-curriculum` as likely alternate endpoints; none returned structured section data (the first fell back to vocab data, the other two just returned the site's HTML shell). Scraping the rendered page for section names would be fragile and is not worth it — Ben can read section names directly off the site page (he confirmed they're visibly listed there) and type them into the config file, same effort as before.
- **Nonexistent stage returns HTTP 200 with `sentences: []`, not an error** — e.g. `stage=99` right now. This is the exact signal to use for "not available yet." As of this planning session, `stage=2` (56 sentences) and `stage=3` (50 sentences) are already both live on SashaWaves, so Ben can test immediately after this ships, and the next click after that will pick up Rekad 3.

**Flow** (single button, one click — no separate preview step):
1. Read current Airtable `Lesson` choices, regex `/^Rekad (\d+)/`, take the max `N` (currently 1).
2. Auth + fetch SashaWaves stage `N+1`. If `sentences` is empty → report "Rekad {N+1} not available yet," stop. No Airtable writes happen unless there's real content to import — this *is* the overwrite-avoidance mechanism Ben asked for; it only ever imports the single next number, never re-touches an existing lesson.
3. Look for `scratch/lesson-{N+1}-manual-config.json`. New **self-contained** shape (folds in `sectionTitles` directly — the old lesson-1-only `SECTION_SEED` hardcoded in `build-rekad1-import.mjs` doesn't generalize to other lessons' topics, so this replaces that pattern entirely):
   ```json
   {
     "lesson": "Rekad 2",
     "classDate": "",
     "sectionTitles": { "Sakacecay": "...", "Sakatosa": "..." },
     "sections": { "Sakacecay": 1, "Sakatolo": [3, 27] }
   }
   ```
   - Found: Lesson name = `"Rekad {N+1} - {classDate}"` (or just `"Rekad {N+1}"` if `classDate` is still blank), sentences whose Order appears in `sections` get `Section = "{name} - {sectionTitles[name]}"`, everything else blank.
   - Not found: Lesson name = `"Rekad {N+1}"` (no date), every sentence gets a blank Section — the same fallback already established for Lesson 1.
4. `Pair Tag` is always set automatically via the existing "?" heuristic (contains "?" → `Q`, else → `A`) — this part never needs manual input; only turning bare tags into numbered, properly paired `Qn`/`An` remains a manual Airtable step, same as Lesson 1.
5. Write to Airtable directly via `fetch()` against the real REST API (10 records per request — Airtable's actual documented limit, not the 50 the Airtable MCP wrapper accepts; the running app has no access to MCP, only to me interactively, so this needs its own HTTP calls).
6. Report result in the UI: lesson imported, sentence count, how many got a section vs. stayed blank.

**Where it lives**: `app/import/page.tsx` (route `/import`) + a Server Action (`"use server"`) doing the fetch/detect/write work, calling into `lib/rekadImport.server.ts` for the SashaWaves + Airtable REST helpers. **Superseded**: this originally had a dev-only `NODE_ENV` gate so it could never run on a deployed build. That gate was later removed (see Deployment section) once Ben needed to use `/import` and `/edit` from his phone — both now work identically in local dev and on the deployed production site, with no auth, by deliberate choice.

**Section titles no longer need manual entry for the common case**: SashaWaves' own frontend bundle ships the 6 section titles as a static `DEFAULT_UNIT_SUBTITLES` object in one of its JS chunks (found by fetching `/_next/static/chunks/*.js` from the lesson page and grepping — the page itself and its RSC payload are empty of content, everything renders client-side after code entry, so this is the only static source). It matches exactly what was already used for Lesson 1 and is named "DEFAULT," suggesting a template reused across lessons. `components/SectionAssignForm.tsx` bakes these in as pre-filled (still editable) defaults. Which sentence's `Order` number seeds each section is not derivable this way and still needs a human reading the sentence list.

**`/import` also has a section-assignment panel** (added after the import button shipped): shows the most recently imported lesson's full sentence list (Order/Amis/Zh/current Section) plus a form (class date + title/order per section) that PATCHes those specific Airtable rows directly via a new `applySections` Server Action — closes the gap where editing `scratch/lesson-N-manual-config.json` by hand did nothing on its own (nothing read and applied it). The form's submission also still writes that file, so it remains a readable record.

**New secrets** (`.env.local` only, never committed):
- `SASHAWAVES_REKAD_CODE=WAVE-2605-A7AY` (Ben's token, already provided)
- A **new, separate, write-scoped** Airtable PAT (`data.records:write` + `data.records:read`, scoped to the Nanamen base) — Ben generates this at airtable.com/create/tokens and pastes it once implementation starts; never reuse the existing read-only `AIRTABLE_API_KEY` used by `sync-content.mjs`.

**Cleanup first** (per Ben, before trying Lesson 2): delete `scripts/seed-audio/*.mp3` (the four test-tone files used only to seed Lesson 1's placeholder durations — no longer needed, currently tracked in git). Stale unused Airtable choices (`Section 1`–`6`, bare `Sakacecay`..`Sakaenem` without titles, `Rekad 1 — unsectioned`, `Lesson 2`/`Lesson 3` placeholders) are **not removable via the Airtable MCP tools available** (`update_field` only supports renaming/formula changes, not choice deletion) — harmless clutter in the dropdown; mention to Ben that removing them is a manual Airtable UI action whenever he wants.

**Retiring old scripts**: `scripts/build-rekad1-import.mjs` (hardcoded to stage 1 + Lesson 1's specific section topics) is superseded by this feature and should be deleted. `scripts/convert-airtable-import.mjs` (generic plain-text paste → CSV, unrelated to SashaWaves) stays — different use case, still valid.

## Verification
- DONE -- `npm run dev`, click through: lesson list → section → Exposure mode (reveal, replay audio, navigate, suspended items skipped) → sentence list (suspend/unsuspend a sentence, confirm it reflects in Exposure) → Fluency mode (replay `Qx` freely, trigger reveal, gap timing, `Ax` reveal, grade, pair-to-pair manual advance, summary screen)
- **NOT DONE** -- Grade a pair "Missed" 1x then "Got it" 3x in a row; confirm it appears then disappears from `/practice-weak`. Suspend a weak pair; confirm it drops out of the weak pool immediately.
- DONE -- Test on a real mobile viewport (Chrome DevTools device emulation at minimum) and desktop width for layout smoothness
- DONE -- Install as PWA (Chrome "Install app") and verify it opens standalone; toggle offline in DevTools and confirm a previously-opened section's audio still plays
- DONE -- Edit a row in Airtable (e.g. add a `Qx` with no matching `Ax` in that section), rerun `npm run dev`/redeploy, confirm the app logs a warning rather than crashing
- DONE -- Rekad import: click the button with no `scratch/lesson-2-manual-config.json` present → confirm it imports Rekad 2 with blank sections and bare Q/A tags, Lesson name `"Rekad 2"`. Click again immediately → confirm it correctly reports Rekad 3 as the next candidate (not a re-import of Rekad 2). With a manual config present, confirm sections/date apply correctly.

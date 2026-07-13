import { escapeHtml } from "@/lib/dialogueFormat";

export type PairTagChoice = "Q" | "A" | null;

export type PairTagSentence = {
  amis: string;
  zh: string;
  choice: PairTagChoice;
  // A data: URI, already fetched from the sentence's Airtable Audio
  // attachment by the caller -- baked in directly so the exported file stays
  // self-contained (an Airtable attachment URL is a short-lived signed link,
  // not something safe to leave as a live reference in a downloaded file).
  audio: string | null;
};

export type PairTagSection = {
  name: string;
  sentences: PairTagSentence[];
};

// Standalone HTML doc for the Pair Tag tab's "Generate html" button: every
// named section from the lesson, rendered one at a time behind a frozen
// "{lesson}-{section}" nav (sections are always the 6 fixed Amis ordinals,
// so this is normally 6 buttons, but it just reflects however many named
// sections are actually present). Reuses the /dialogue export's chat-bubble
// look -- Q on the left, A on the right -- but sentences without a Q/A
// choice are plain, centered lines instead of bubbles, and every line shows
// both Amis and Zh (unlike the dialogue export, which is Amis-only).
export function renderPairTagOverviewHtml(sections: PairTagSection[], lessonNumber: number): string {
  const namedSections = sections.filter((s) => s.name !== "No section");
  const title = `Lesson ${lessonNumber}`;

  const navButtons = namedSections
    .map((_, i) => {
      const n = i + 1;
      return `    <button type="button" class="nav-btn${n === 1 ? " active" : ""}" data-target="${n}" onclick="showSection(${n})">${lessonNumber}-${n}</button>`;
    })
    .join("\n");

  const sectionViews = namedSections
    .map((section, i) => {
      const n = i + 1;

      const lines = section.sentences
        .map((s) => {
          const audioTag = s.audio ? `<audio preload="none" src="${s.audio}"></audio>` : "";
          const onClick = s.audio ? ` onclick="this.querySelector('audio').play()"` : "";
          if (s.choice === "Q" || s.choice === "A") {
            const cls = `bubble ${s.choice === "Q" ? "s0" : "s1"}${s.audio ? " has-audio" : ""}`;
            return `      <div class="${cls}"${onClick}>
        <div class="amis">${escapeHtml(s.amis)}</div>
        <div class="zh">${escapeHtml(s.zh)}</div>
        ${audioTag}
      </div>`;
          }
          const cls = `plain${s.audio ? " has-audio" : ""}`;
          return `      <p class="${cls}"${onClick}>
        <span class="amis">${escapeHtml(s.amis)}</span>
        <span class="zh">${escapeHtml(s.zh)}</span>
        ${audioTag}
      </p>`;
        })
        .join("\n");

      const playAllButton = section.sentences.some((s) => s.audio)
        ? `    <button type="button" class="play-all" onclick="playSection(this)">&#9654; Play all</button>\n`
        : "";

      return `  <section class="section-view" data-section="${n}" style="display: ${n === 1 ? "flex" : "none"}">
${playAllButton}${lines}
  </section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    padding: 0 1rem 2rem;
    background: #fafaf9;
    color: #1c1917;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  main {
    max-width: 40rem;
    margin: 0 auto;
  }
  header.page-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: #fafaf9;
  }
  .title-row {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.25rem 2.75rem 0.75rem;
  }
  h1 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
    text-align: center;
  }
  .eye-btn {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border: none;
    background: transparent;
    color: #57534e;
    border-radius: 999px;
    cursor: pointer;
  }
  .eye-btn:active { background: #e7e5e4; }
  .eye-btn svg { width: 1.25rem; height: 1.25rem; }
  .eye-btn .icon-off { display: none; }
  body.zh-hidden .eye-btn .icon-on { display: none; }
  body.zh-hidden .eye-btn .icon-off { display: block; }
  nav.section-nav {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    padding: 0 0 0.75rem;
    border-bottom: 1px solid #e7e5e4;
  }
  .nav-btn {
    border: 1px solid #d6d3d1;
    background: transparent;
    color: #57534e;
    border-radius: 999px;
    padding: 0.35rem 0.85rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }
  .nav-btn.active {
    background: #7c3aed;
    border-color: #7c3aed;
    color: #ffffff;
  }
  .section-view {
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 1.25rem;
  }
  .play-all {
    align-self: center;
    border: none;
    border-radius: 999px;
    padding: 0.4rem 0.9rem;
    margin-bottom: 0.25rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: #ffffff;
    background: #7c3aed;
    cursor: pointer;
  }
  .has-audio { cursor: pointer; }
  .has-audio:active { opacity: 0.85; }
  .bubble {
    max-width: 78%;
    padding: 0.5rem 1.1rem;
    border-radius: 1rem;
  }
  .bubble .amis { font-size: 1.25rem; line-height: 1.6; }
  .bubble .zh { font-size: 0.85rem; line-height: 1.4; opacity: 0.75; margin-top: 0.15rem; }
  .bubble.s0 { align-self: flex-start; background: #e7e5e4; color: #1c1917; }
  .bubble.s1 { align-self: flex-end; background: #7c3aed; color: #ffffff; }
  p.plain {
    margin: 0.25rem auto;
    max-width: 90%;
    text-align: center;
  }
  p.plain .amis { display: block; font-size: 1.1rem; line-height: 1.5; }
  p.plain .zh { display: block; font-size: 0.85rem; line-height: 1.4; opacity: 0.6; margin-top: 0.1rem; }
  /* Must come after the .zh rules above -- same specificity as p.plain .zh,
     so source order is what makes the toggle win for "none"-tagged lines. */
  body.zh-hidden .zh { display: none; }
  @media (prefers-color-scheme: dark) {
    body { background: #0c0a09; color: #fafaf9; }
    header.page-header { background: #0c0a09; }
    nav.section-nav { border-bottom-color: #292524; }
    .eye-btn { color: #d6d3d1; }
    .eye-btn:active { background: #292524; }
    .nav-btn { border-color: #44403c; color: #d6d3d1; }
    .bubble.s0 { background: #44403c; color: #f5f5f4; }
  }
</style>
</head>
<body class="zh-hidden">
<main>
  <header class="page-header">
    <div class="title-row">
      <h1>${escapeHtml(title)}</h1>
      <button type="button" class="eye-btn" onclick="toggleZh()" aria-label="Toggle Chinese translation">
        <svg class="icon-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
        <svg class="icon-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.73 5.08a10.75 10.75 0 0 1 11.2 6.57 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.5"/><path d="M14.08 14.16a3 3 0 1 1-4.24-4.24"/><path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14"/><path d="m2 2 20 20"/></svg>
      </button>
    </div>
    <nav class="section-nav">
${navButtons}
    </nav>
  </header>
${sectionViews}
</main>
<script>
  function showSection(n) {
    document.querySelectorAll(".section-view").forEach(function (el) {
      el.style.display = el.dataset.section === String(n) ? "flex" : "none";
    });
    document.querySelectorAll(".nav-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.target === String(n));
    });
  }
  function toggleZh() {
    document.body.classList.toggle("zh-hidden");
  }
  function playSection(btn) {
    var section = btn.closest(".section-view");
    var audios = Array.prototype.slice.call(section.querySelectorAll("audio"));
    var i = 0;
    (function playNext() {
      if (i >= audios.length) return;
      var a = audios[i++];
      a.currentTime = 0;
      a.onended = playNext;
      a.play();
    })();
  }
</script>
</body>
</html>
`;
}

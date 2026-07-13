export type DialogueLine = { text: string; speaker: 0 | 1 };

// Blank lines are dropped and don't consume a speaker slot, so stray blank
// lines from manual edits don't desync the ABAB alternation.
export function splitDialogueLines(draft: string): DialogueLine[] {
  const lines: DialogueLine[] = [];
  let speaker: 0 | 1 = 0;
  for (const raw of draft.split("\n")) {
    const text = raw.trim();
    if (!text) continue;
    lines.push({ text, speaker });
    speaker = speaker === 0 ? 1 : 0;
  }
  return lines;
}

// Shared by the HTML export, the practice overlay, and the JPG export so all
// three always show the same title -- "Rekad 3 - 26/07/15" becomes "Lesson 3".
export function dialogueTitle(lessonTitle: string): string {
  const match = lessonTitle.match(/(\d+)/);
  return match ? `Lesson ${match[1]}` : lessonTitle;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Standalone HTML doc: inline <style> only (no Tailwind at file-open time),
// with a prefers-color-scheme media query since a downloaded file has no
// access to the app's dark-class toggle.
export function renderDialogueHtml(lines: DialogueLine[], lessonTitle: string): string {
  const title = dialogueTitle(lessonTitle);
  const body = lines
    .map((line) => `    <p class="s${line.speaker}">${escapeHtml(line.text)}</p>`)
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
    padding: 2rem 1rem;
    background: #fafaf9;
    color: #1c1917;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  main {
    max-width: 40rem;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  h1 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
  }
  p {
    margin: 0;
    max-width: 78%;
    padding: 0.5rem 1.1rem;
    border-radius: 1rem;
    font-size: 1.25rem;
    line-height: 1.6;
  }
  p.s0 { align-self: flex-start; background: #e7e5e4; color: #1c1917; }
  p.s1 { align-self: flex-end; background: #7c3aed; color: #ffffff; }
  @media (prefers-color-scheme: dark) {
    body { background: #0c0a09; color: #fafaf9; }
    p.s0 { background: #44403c; color: #f5f5f4; }
  }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(title)}</h1>
${body}
</main>
</body>
</html>
`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Rasterizes the same messenger-style layout as renderDialogueHtml for the
// JPG export. Browser-only (uses document.createElement("canvas")) -- only
// ever called from a client-side click handler, never during SSR.
export function renderDialogueCanvas(lines: DialogueLine[], lessonTitle: string): HTMLCanvasElement {
  const title = dialogueTitle(lessonTitle);
  const width = 640;
  const pad = 24;
  const bubblePadX = 18;
  const bubblePadY = 8;
  const maxBubbleWidth = width * 0.78 - pad * 2;
  const fontSize = 18;
  const lineHeight = 26;
  const titleFontSize = 20;
  const gap = 12;
  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const wrapText = (text: string, maxWidth: number): string[] => {
    const words = text.split(" ");
    const result: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        result.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) result.push(line);
    return result;
  };

  ctx.font = `${fontSize}px ${fontFamily}`;
  const bubbleTextMaxWidth = maxBubbleWidth - bubblePadX * 2;
  const wrapped = lines.map((line) => ({ ...line, wrappedLines: wrapText(line.text, bubbleTextMaxWidth) }));

  let y = pad + titleFontSize + 20;
  const geometries = wrapped.map((line) => {
    const textWidth = Math.max(0, ...line.wrappedLines.map((l) => ctx.measureText(l).width));
    const bubbleWidth = Math.min(maxBubbleWidth, textWidth + bubblePadX * 2);
    const bubbleHeight = line.wrappedLines.length * lineHeight + bubblePadY * 2;
    const geometry = { ...line, bubbleWidth, bubbleHeight, y };
    y += bubbleHeight + gap;
    return geometry;
  });

  canvas.width = width;
  canvas.height = y - gap + pad;

  ctx.fillStyle = "#fafaf9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textBaseline = "top";
  ctx.fillStyle = "#1c1917";
  ctx.font = `600 ${titleFontSize}px ${fontFamily}`;
  ctx.fillText(title, pad, pad);

  ctx.font = `${fontSize}px ${fontFamily}`;
  for (const bg of geometries) {
    const isRight = bg.speaker === 1;
    const x = isRight ? width - pad - bg.bubbleWidth : pad;
    ctx.fillStyle = isRight ? "#7c3aed" : "#e7e5e4";
    roundRect(ctx, x, bg.y, bg.bubbleWidth, bg.bubbleHeight, 14);
    ctx.fill();
    ctx.fillStyle = isRight ? "#ffffff" : "#1c1917";
    bg.wrappedLines.forEach((l, i) => {
      ctx.fillText(l, x + bubblePadX, bg.y + bubblePadY + i * lineHeight);
    });
  }

  return canvas;
}

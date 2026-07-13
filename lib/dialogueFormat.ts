export type DialogueLine = { text: string; speaker: 0 | 1; dividerBefore?: boolean };

// Blank lines are dropped and don't consume a speaker slot, so stray blank
// lines from manual edits don't desync the ABAB alternation. A blank line
// is instead remembered as a divider marker on the next non-blank line, so
// the preview/export can render a section break where the author put one.
export function splitDialogueLines(draft: string): DialogueLine[] {
  const lines: DialogueLine[] = [];
  let speaker: 0 | 1 = 0;
  let pendingDivider = false;
  for (const raw of draft.split("\n")) {
    const text = raw.trim();
    if (!text) {
      if (lines.length > 0) pendingDivider = true;
      continue;
    }
    lines.push(pendingDivider ? { text, speaker, dividerBefore: true } : { text, speaker });
    pendingDivider = false;
    speaker = speaker === 0 ? 1 : 0;
  }
  return lines;
}

// Shared by the HTML export, the practice overlay, and the JPG export so all
// three always show the same title -- "Rekad 3 - 26/07/15" becomes "Rekad 3 - 對話".
export function dialogueTitle(lessonTitle: string): string {
  const match = lessonTitle.match(/(\d+)/);
  return match ? `Rekad ${match[1]} - 對話` : lessonTitle;
}

// Inverse of renderDialogueHtml, for the DialogueBuilder's import button --
// a .txt file is used as-is, an .html file (ours or otherwise) has its
// paragraph text pulled out in document order and rejoined with newlines,
// same shape splitDialogueLines expects (speaker alternation is re-derived
// from line order on the way back in, not read off the file). Browser-only
// (DOMParser) -- only ever called from a client-side file input handler.
export function parseImportedDialogue(filename: string, text: string): string {
  const looksLikeHtml = /\.html?$/i.test(filename) || /<\/?(?:html|body|main|p)[\s>]/i.test(text);
  if (!looksLikeHtml) return text.trim();

  const doc = new DOMParser().parseFromString(text, "text/html");
  const root = doc.querySelector("main") ?? doc.body;
  return Array.from(root.querySelectorAll("p"))
    .map((p) => p.textContent?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Standalone HTML doc: inline <style>/<script> only (no Tailwind, no
// external audio hosting at file-open time) -- audioClips (data: URIs, keyed
// by index into `lines`) are baked directly into the file so it stays fully
// self-contained after download. Bubbles with a clip get an inline <audio>
// + click-to-play; the header "Play all" button (shown only if at least one
// clip exists) sequences through them via a tiny inline script.
export function renderDialogueHtml(
  lines: DialogueLine[],
  lessonTitle: string,
  audioClips?: Record<number, string>,
): string {
  const title = dialogueTitle(lessonTitle);
  const hasAudio = !!audioClips && Object.keys(audioClips).length > 0;

  const body = lines
    .map((line, i) => {
      const clip = audioClips?.[i];
      const cls = clip ? `s${line.speaker} has-audio` : `s${line.speaker}`;
      const onClick = clip ? ` onclick="this.querySelector('audio').play()"` : "";
      const audioTag = clip ? `<audio preload="none" src="${clip}"></audio>` : "";
      const divider = line.dividerBefore ? `    <hr />\n` : "";
      return `${divider}    <p class="${cls}"${onClick}>${escapeHtml(line.text)}${audioTag}</p>`;
    })
    .join("\n");

  const playAllButton = hasAudio
    ? `  <button type="button" class="play-all" onclick="playAll()">&#9654; Play all</button>\n`
    : "";
  const playAllScript = hasAudio
    ? `<script>
  function playAll() {
    var audios = Array.prototype.slice.call(document.querySelectorAll("main audio"));
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
`
    : "";

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
    position: relative;
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 0.75rem;
  }
  .play-all {
    position: absolute;
    right: 0;
    border: none;
    border-radius: 999px;
    padding: 0.4rem 0.9rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: #ffffff;
    background: #7c3aed;
    cursor: pointer;
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
  p.has-audio { cursor: pointer; }
  p.has-audio:active { opacity: 0.85; }
  hr { width: 100%; margin: 0.25rem 0; border: none; border-top: 1px dashed #d6d3d1; }
  @media (prefers-color-scheme: dark) {
    body { background: #0c0a09; color: #fafaf9; }
    p.s0 { background: #44403c; color: #f5f5f4; }
    hr { border-top-color: #57534e; }
  }
</style>
</head>
<body>
<main>
  <h1>
    <span>${escapeHtml(title)}</span>
${playAllButton}  </h1>
${body}
</main>
${playAllScript}</body>
</html>
`;
}

// 16-bit PCM WAV encoder for a decoded AudioBuffer -- no library, just the
// standard 44-byte RIFF/WAVE header followed by interleaved samples.
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channels = Array.from({ length: numChannels }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

// Decodes each per-line clip (data: URIs from the TTS route) via the Web
// Audio API and concatenates them into one WAV blob -- works regardless of
// the source format (decodeAudioData handles it), so no assumption about
// what the TTS endpoint actually returns. Browser-only -- only ever called
// from a client-side click handler.
export async function concatenateAudioClips(dataUris: string[]): Promise<Blob> {
  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioContextCtor();
  try {
    const buffers = await Promise.all(
      dataUris.map(async (uri) => ctx.decodeAudioData(await (await fetch(uri)).arrayBuffer())),
    );
    const numChannels = Math.max(...buffers.map((b) => b.numberOfChannels));
    const sampleRate = buffers[0]?.sampleRate ?? ctx.sampleRate;
    const gapFrames = Math.round(0.5 * sampleRate);
    const totalFrames = buffers.reduce((sum, b) => sum + b.length, 0) + gapFrames * Math.max(0, buffers.length - 1);
    // createBuffer's channel data starts zero-filled, so the gaps between
    // clips don't need to be written at all -- just skipped over.
    const combined = ctx.createBuffer(numChannels, totalFrames, sampleRate);
    let writeOffset = 0;
    buffers.forEach((buf, i) => {
      for (let c = 0; c < numChannels; c++) {
        combined.getChannelData(c).set(buf.getChannelData(c < buf.numberOfChannels ? c : 0), writeOffset);
      }
      writeOffset += buf.length + (i < buffers.length - 1 ? gapFrames : 0);
    });
    return audioBufferToWavBlob(combined);
  } finally {
    ctx.close();
  }
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

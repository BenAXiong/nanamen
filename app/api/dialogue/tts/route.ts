export const runtime = "nodejs";

// Public ILRDF Gradio Space, no API key -- base URL kept in an env var
// rather than hardcoded since it's ILRDF infra and could move. Unset
// locally until ILRDF_TTS_URL is added to .env.local.
const ILRDF_TTS_BASE = process.env.ILRDF_TTS_URL ?? "";
const TIMEOUT_MS = 20000;
const MAX_CHARS = 300;

// This app only ever speaks Malan Amis -- skip the dialect-code-to-speaker
// mapping table Indivore uses for its 5 dialects and hardcode the one voice.
const SPEAKER = "阿美_馬蘭_女聲";

const AUDIO_MIME_TYPES: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
};

// Gradio's static file server serves this Space's output as
// `application/octet-stream` regardless of the actual format (confirmed by
// inspecting the file's magic bytes -- it's a real RIFF/WAVE file) -- so the
// upstream content-type header can't be trusted. The returned file URL's own
// extension (e.g. ".../audio.wav") is reliable, so derive the type from
// that instead. Defaults to wav, this Space's only observed output format.
function audioMimeTypeFromUrl(url: string): string {
  const ext = url.split(/[?#]/)[0]?.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_MIME_TYPES[ext] ?? "audio/wav";
}

// Submits text to the Space and resolves to the generated audio file's URL,
// or null on any failure (bad response, no event_id, no stream body,
// timeout, or the Space itself erroring out). This is a third-party
// research endpoint with no SLA -- fail soft here, don't throw, so a down
// Space degrades to "audio unavailable" rather than a crash.
async function gradioFileCall(base: string, fn: string, data: unknown[]): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const submitRes = await fetch(`${base}/gradio_api/call/${fn}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data }),
      signal: controller.signal,
    });
    if (!submitRes.ok) return null;
    const { event_id } = (await submitRes.json()) as { event_id?: string };
    if (!event_id) return null;

    const streamRes = await fetch(`${base}/gradio_api/call/${fn}/${event_id}`, { signal: controller.signal });
    if (!streamRes.ok || !streamRes.body) return null;

    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let result: string | null = null;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const match = /event:\s*complete[\r\n]+data:\s*(\[[\s\S]+?\])\s*$/.exec(buf);
        if (match) {
          const arr = JSON.parse(match[1]) as unknown[];
          const fileData = arr[0] as { url?: string | null };
          result = fileData?.url ?? null;
          break;
        }
      }
    } finally {
      reader.cancel().catch(() => {
        // already cancelled or closed
      });
    }
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const { text } = body as { text?: string };
  const trimmed = text?.trim() ?? "";
  if (!trimmed || trimmed.length > MAX_CHARS) {
    return Response.json({ error: `Text must be 1-${MAX_CHARS} characters.` }, { status: 400 });
  }

  if (!ILRDF_TTS_BASE) {
    return Response.json({ error: "TTS not yet configured" }, { status: 501 });
  }

  const fileUrl = await gradioFileCall(ILRDF_TTS_BASE, "default_speaker_tts", [SPEAKER, trimmed]);
  if (!fileUrl) {
    return Response.json({ error: "TTS service unavailable." }, { status: 503 });
  }

  // Proxy the audio bytes back (rather than returning the URL as JSON, like
  // Indivore's route does) so the client's existing same-origin Blob
  // play/download keeps working without cross-origin download quirks.
  const fileController = new AbortController();
  const fileTimeout = setTimeout(() => fileController.abort(), TIMEOUT_MS);
  try {
    const fileRes = await fetch(fileUrl, { signal: fileController.signal });
    if (!fileRes.ok || !fileRes.body) {
      return Response.json({ error: "TTS service unavailable." }, { status: 503 });
    }
    return new Response(fileRes.body, {
      headers: { "content-type": audioMimeTypeFromUrl(fileUrl) },
    });
  } catch {
    return Response.json({ error: "TTS service unavailable." }, { status: 503 });
  } finally {
    clearTimeout(fileTimeout);
  }
}

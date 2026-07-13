export const runtime = "nodejs";

import { put } from "@vercel/blob";

// Uploads a generated-audio clip (from /api/dialogue/tts) to Vercel Blob so
// it has a public URL Airtable's attachment API can fetch -- Airtable only
// accepts attachments by URL, not raw bytes, and a deployment's own
// filesystem is read-only at runtime (see DEC-CONTENT01), so there's nowhere
// else in this app to host the file.
export async function POST(request: Request) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing BLOB_READ_WRITE_TOKEN in .env.local" }, { status: 501 });
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) {
    return Response.json({ error: "No audio data received." }, { status: 400 });
  }

  try {
    const blob = await put(`edit-audio/${Date.now()}.wav`, Buffer.from(bytes), {
      access: "public",
      contentType: "audio/wav",
      token,
    });
    return Response.json({ url: blob.url });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

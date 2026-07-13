// Stub -- no TTS provider wired up yet. Returns 501 until a real
// provider/API key is chosen. If we ever persist generated audio
// server-side (e.g. into public/audio), see app/actions.ts's
// resyncContent for the read-only-filesystem-on-Vercel constraint that
// would apply.
export async function POST() {
  return Response.json({ error: "TTS not yet configured" }, { status: 501 });
}

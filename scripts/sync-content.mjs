// Pulls sentence content + audio from Airtable and writes a static snapshot the
// app reads at runtime. Runs automatically via the `predev`/`prebuild` npm hooks
// (see DEC-CONTENT01) -- content edited in Airtable shows up on the next dev
// server start / deploy, no manual step required.
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseBuffer } from "music-metadata";

// process.cwd() rather than import.meta.dirname: both npm-script invocation
// (predev/prebuild/content:sync, always run from the project root) and the
// dev-only import from app/layout.tsx rely on this resolving correctly, and
// webpack's RSC bundling of this module (the layout import) doesn't populate
// import.meta.dirname the way plain `node scripts/sync-content.mjs` does.
const ROOT = process.cwd();
const BASE_ID = "app8MvGUBu4Xg9HOR";
const TABLE_ID = "tbl0IiPCsGxOZAcBL";
const AUDIO_DIR = path.join(ROOT, "public", "audio");
const OUTPUT_FILE = path.join(ROOT, "content", "generated", "sentences.json");
const AUDIO_EXTENSIONS_BY_MIME = new Map([
  ["audio/mpeg", ".mp3"],
  ["audio/mp3", ".mp3"],
  ["audio/wav", ".wav"],
  ["audio/x-wav", ".wav"],
  ["audio/webm", ".webm"],
  ["audio/ogg", ".ogg"],
  ["audio/mp4", ".m4a"],
  ["audio/aac", ".aac"],
]);

async function loadLocalEnv() {
  if (process.env.AIRTABLE_API_KEY) return;
  try {
    const raw = await readFile(path.join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
    }
  } catch {
    // no .env.local (e.g. on Vercel, env vars are already injected)
  }
}

async function fetchAllRecords() {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` },
    });
    if (!res.ok) {
      throw new Error(`Airtable fetch failed: ${res.status} ${await res.text()}`);
    }
    const body = await res.json();
    records.push(...body.records);
    offset = body.offset;
  } while (offset);
  return records;
}

function slugify(label) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Amis ordinals 1-9, used as a fallback for section names like "Sakacecay"
// (Saka + cecay = "the first") that carry no trailing digit to sort by.
const AMIS_ORDINALS = { cecay: 1, tosa: 2, tolo: 3, sepat: 4, lima: 5, enem: 6, pito: 7, falo: 8, siwa: 9 };

// "Lesson 3" / "Section 6" -> 3 / 6, for stable numeric ordering regardless of
// Airtable row order (we don't rely on the select field's internal choice order).
// Falls back to Amis ordinal words, then pushes any "unsectioned" catch-all
// bucket to the end rather than letting it tie at 0 with everything else.
function trailingNumber(label) {
  const digitMatch = label.match(/(\d+)\s*$/);
  if (digitMatch) return Number(digitMatch[1]);

  const lower = label.toLowerCase();
  for (const [word, n] of Object.entries(AMIS_ORDINALS)) {
    if (lower.includes(word)) return n;
  }
  if (lower.includes("unsectioned")) return 999;
  return 0;
}

// "Rekad 3 - 26/07/15" -> 3, not 15 -- trailingNumber() would match the last
// digits in the string, which for a dated lesson name is part of the class
// date, not the lesson number. Lessons are always "Rekad N" or "Lesson N",
// optionally followed by " - YY/MM/DD", so the number right after that word
// is authoritative.
function lessonNumber(label) {
  const match = label.match(/^(?:Rekad|Lesson)\s+(\d+)/i);
  if (match) return Number(match[1]);
  return trailingNumber(label);
}

function parsePairTag(tag) {
  if (!tag) return { role: null, number: null };
  const match = /^([QA])(\d+)$/i.exec(tag.trim());
  if (!match) return { role: null, number: null };
  return { role: match[1].toUpperCase() === "Q" ? "question" : "answer", number: Number(match[2]) };
}

function audioExtension(attachment) {
  const filenameExt = path.extname(attachment.filename ?? "").toLowerCase();
  if (filenameExt) return filenameExt;

  const mime = String(attachment.type ?? "").toLowerCase().split(";")[0].trim();
  if (AUDIO_EXTENSIONS_BY_MIME.has(mime)) return AUDIO_EXTENSIONS_BY_MIME.get(mime);

  try {
    const urlExt = path.extname(new URL(attachment.url).pathname).toLowerCase();
    if (urlExt) return urlExt;
  } catch {
    // Airtable normally provides absolute attachment URLs; keep a conservative fallback.
  }

  return ".mp3";
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// A repeat sync (e.g. triggered on every dev-server page load, see
// app/layout.tsx) re-fetches Airtable's records every time -- cheap -- but
// must not re-download audio it already has on disk, or every navigation
// would pay for 50-150 attachment fetches it doesn't need.
async function downloadAudio(attachment, destPath) {
  if (await fileExists(destPath)) {
    try {
      const buffer = await readFile(destPath);
      const meta = await parseBuffer(buffer, attachment.type);
      return meta.format.duration ?? null;
    } catch (err) {
      console.warn(`  warning: could not read duration for existing ${destPath}: ${err.message}`);
      return null;
    }
  }

  const res = await fetch(attachment.url);
  if (!res.ok) throw new Error(`Audio download failed (${res.status}): ${attachment.url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await mkdir(path.dirname(destPath), { recursive: true });
  await writeFile(destPath, buffer);
  let durationSeconds = null;
  try {
    const contentType = res.headers.get("content-type") ?? attachment.type;
    const meta = await parseBuffer(buffer, contentType);
    durationSeconds = meta.format.duration ?? null;
  } catch (err) {
    console.warn(`  warning: could not read duration for ${destPath}: ${err.message}`);
  }
  return durationSeconds;
}

export async function syncContent() {
  await loadLocalEnv();
  if (!process.env.AIRTABLE_API_KEY) {
    throw new Error("AIRTABLE_API_KEY is not set (checked process.env and .env.local)");
  }

  const records = await fetchAllRecords();
  console.log(`Fetched ${records.length} record(s) from Airtable.`);

  const lessonsBySlug = new Map();

  for (const record of records) {
    const f = record.fields;
    if (!f.Lesson || !f.Amis) {
      console.warn(`  warning: skipping record ${record.id}, missing Lesson/Amis`);
      continue;
    }
    // No Section yet is expected -- content waiting to be manually sorted into
    // a section doesn't show up in the app until it is, but it's not a mistake.
    if (!f.Section) continue;

    const lessonSlug = slugify(f.Lesson);
    const sectionSlug = slugify(f.Section);
    const { role: pairRole, number: pairNumber } = parsePairTag(f["Pair Tag"]);
    // Bare "Q"/"A" (no number) is an expected in-progress state -- a rough seed
    // tag before manual numbering/pairing, not a mistake worth warning about.
    if (f["Pair Tag"] && pairRole === null && !/^[QA]$/i.test(f["Pair Tag"].trim())) {
      console.warn(`  warning: unrecognized Pair Tag "${f["Pair Tag"]}" on record ${record.id} (expected Qn/An), treating as untagged`);
    }

    const localId = f["Pair Tag"] ? f["Pair Tag"].toLowerCase() : `s${f.Order ?? record.id}`;
    let audioUrl = null;
    let durationSeconds = null;
    const attachment = f.Audio?.[0];
    if (attachment) {
      const extension = audioExtension(attachment);
      const destPath = path.join(AUDIO_DIR, lessonSlug, sectionSlug, `${localId}${extension}`);
      durationSeconds = await downloadAudio(attachment, destPath);
      audioUrl = `/audio/${lessonSlug}/${sectionSlug}/${localId}${extension}`;
    } else {
      console.warn(`  warning: no audio for "${f.Amis}" (${lessonSlug}/${sectionSlug})`);
    }

    if (!lessonsBySlug.has(lessonSlug)) {
      lessonsBySlug.set(lessonSlug, { slug: lessonSlug, title: f.Lesson, order: lessonNumber(f.Lesson), sectionsBySlug: new Map() });
    }
    const lesson = lessonsBySlug.get(lessonSlug);
    if (!lesson.sectionsBySlug.has(sectionSlug)) {
      lesson.sectionsBySlug.set(sectionSlug, { slug: sectionSlug, title: f.Section, order: trailingNumber(f.Section), sentences: [] });
    }
    const section = lesson.sectionsBySlug.get(sectionSlug);

    section.sentences.push({
      id: `${lessonSlug}/${sectionSlug}/${localId}`,
      order: f.Order ?? 0,
      amis: f.Amis,
      zh: f.Zh ?? "",
      audioUrl,
      durationSeconds,
      pairTag: f["Pair Tag"] || null,
      pairNumber,
      pairRole,
    });
  }

  const lessons = [...lessonsBySlug.values()]
    .sort((a, b) => a.order - b.order)
    .map((lesson) => ({
      slug: lesson.slug,
      title: lesson.title,
      sections: [...lesson.sectionsBySlug.values()]
        .sort((a, b) => a.order - b.order)
        .map((section) => {
          section.sentences.sort((a, b) => a.order - b.order);
          validatePairing(section);
          return { slug: section.slug, title: section.title, sentences: section.sentences };
        }),
    }));

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(lessons, null, 2));
  console.log(`Wrote ${OUTPUT_FILE}`);
}

function validatePairing(section) {
  const byNumber = new Map();
  for (const sentence of section.sentences) {
    if (sentence.pairNumber === null) continue;
    if (!byNumber.has(sentence.pairNumber)) byNumber.set(sentence.pairNumber, {});
    const entry = byNumber.get(sentence.pairNumber);
    if (entry[sentence.pairRole]) {
      console.warn(`  warning: duplicate ${sentence.pairTag} in ${section.slug}`);
    }
    entry[sentence.pairRole] = sentence;
  }
  for (const [number, entry] of byNumber) {
    if (!entry.question || !entry.answer) {
      console.warn(`  warning: incomplete pair ${number} in ${section.slug} (has ${Object.keys(entry).join(", ") || "neither"})`);
    }
  }
}

// Only run as a CLI entry point (predev/prebuild/content:sync) -- when this
// module is imported instead (app/layout.tsx's dev-only auto-resync), the
// importer awaits syncContent() itself and handles its own errors.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  syncContent().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

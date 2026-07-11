// Pulls sentence content + audio from Airtable and writes a static snapshot the
// app reads at runtime. Runs automatically via the `predev`/`prebuild` npm hooks
// (see DEC-CONTENT01) -- content edited in Airtable shows up on the next dev
// server start / deploy, no manual step required.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { parseBuffer } from "music-metadata";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE_ID = "app8MvGUBu4Xg9HOR";
const TABLE_ID = "tbl0IiPCsGxOZAcBL";
const AUDIO_DIR = path.join(ROOT, "public", "audio");
const OUTPUT_FILE = path.join(ROOT, "content", "generated", "sentences.json");

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

// "Lesson 3" / "Section 6" -> 3 / 6, for stable numeric ordering regardless of
// Airtable row order (we don't rely on the select field's internal choice order).
function trailingNumber(label) {
  const match = label.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

function parsePairTag(tag) {
  if (!tag) return { role: null, number: null };
  const match = /^([QA])(\d+)$/i.exec(tag.trim());
  if (!match) return { role: null, number: null };
  return { role: match[1].toUpperCase() === "Q" ? "question" : "answer", number: Number(match[2]) };
}

async function downloadAudio(attachment, destPath) {
  const res = await fetch(attachment.url);
  if (!res.ok) throw new Error(`Audio download failed (${res.status}): ${attachment.url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await mkdir(path.dirname(destPath), { recursive: true });
  await writeFile(destPath, buffer);
  let durationSeconds = null;
  try {
    const meta = await parseBuffer(buffer, attachment.type);
    durationSeconds = meta.format.duration ?? null;
  } catch (err) {
    console.warn(`  warning: could not read duration for ${destPath}: ${err.message}`);
  }
  return durationSeconds;
}

async function main() {
  await loadLocalEnv();
  if (!process.env.AIRTABLE_API_KEY) {
    throw new Error("AIRTABLE_API_KEY is not set (checked process.env and .env.local)");
  }

  const records = await fetchAllRecords();
  console.log(`Fetched ${records.length} record(s) from Airtable.`);

  const lessonsBySlug = new Map();

  for (const record of records) {
    const f = record.fields;
    if (!f.Lesson || !f.Section || !f.Amis) {
      console.warn(`  warning: skipping record ${record.id}, missing Lesson/Section/Amis`);
      continue;
    }

    const lessonSlug = slugify(f.Lesson);
    const sectionSlug = slugify(f.Section);
    const { role: pairRole, number: pairNumber } = parsePairTag(f["Pair Tag"]);
    if (f["Pair Tag"] && pairRole === null) {
      console.warn(`  warning: unrecognized Pair Tag "${f["Pair Tag"]}" on record ${record.id} (expected Qn/An), treating as untagged`);
    }

    const localId = f["Pair Tag"] ? f["Pair Tag"].toLowerCase() : `s${f.Order ?? record.id}`;
    let audioUrl = null;
    let durationSeconds = null;
    const attachment = f.Audio?.[0];
    if (attachment) {
      const destPath = path.join(AUDIO_DIR, lessonSlug, sectionSlug, `${localId}.mp3`);
      durationSeconds = await downloadAudio(attachment, destPath);
      audioUrl = `/audio/${lessonSlug}/${sectionSlug}/${localId}.mp3`;
    } else {
      console.warn(`  warning: no audio for "${f.Amis}" (${lessonSlug}/${sectionSlug})`);
    }

    if (!lessonsBySlug.has(lessonSlug)) {
      lessonsBySlug.set(lessonSlug, { slug: lessonSlug, title: f.Lesson, order: trailingNumber(f.Lesson), sectionsBySlug: new Map() });
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

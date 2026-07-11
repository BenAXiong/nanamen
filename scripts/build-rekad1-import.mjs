// Builds Airtable import files for SashaWaves Malan Rekad 1.
//
// Required:
//   REKAD_CODE=WAVE-... npm run content:rekad1-import
//
// Outputs:
//   scratch/lesson-1-airtable-import.csv
//   scratch/lesson-1-section-seed.csv
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ORIGIN = "https://sashawaves.com";
const OUTPUT_DIR = path.join(ROOT, "scratch");
const SENTENCES_OUTPUT = path.join(OUTPUT_DIR, "lesson-1-airtable-import.csv");
const SECTIONS_OUTPUT = path.join(OUTPUT_DIR, "lesson-1-section-seed.csv");
const LESSON = "Lesson 1";
const IMPORT_SECTION = "Rekad 1 — unsectioned";
const HEADERS = ["Lesson", "Section", "Order", "Pair Tag", "Amis", "Zh", "Audio"];
const SECTION_HEADERS = ["Lesson", "Section", "Section Subtitle", "Order"];

const SECTION_SEED = [
  { order: 1, section: "Sakacecay", subtitle: "入門詞彙・基本問候" },
  { order: 2, section: "Sakatosa", subtitle: "日常對話・家庭稱謂" },
  { order: 3, section: "Sakatolo", subtitle: "動詞變化・否定句" },
  { order: 4, section: "Sakasepat", subtitle: "進階句型・複合詞" },
  { order: 5, section: "Sakalima", subtitle: "深度文化・敬語" },
  { order: 6, section: "Sakaenem", subtitle: "文化場景・即興表達" },
];

function toCsvValue(value) {
  const raw = String(value ?? "");
  if (/[",\r\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function toCsv(headers, rows) {
  return `${[
    headers.join(","),
    ...rows.map((row) => headers.map((header) => toCsvValue(row[header])).join(",")),
  ].join("\n")}\n`;
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(async () => ({ raw: await res.text() }));
  if (!res.ok) {
    const reason = body?.reason ?? body?.error ?? body?.raw ?? "unknown error";
    throw new Error(`${url} failed: ${res.status} ${reason}`);
  }
  return body;
}

async function getToken(code) {
  const body = await fetchJson(`${ORIGIN}/api/rekad-auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!body?.success || !body?.token) throw new Error("Rekad activation failed.");
  return body.token;
}

async function main() {
  const code = process.env.REKAD_CODE;
  if (!code) {
    throw new Error("REKAD_CODE is required. Example: REKAD_CODE=WAVE-... npm run content:rekad1-import");
  }

  const token = await getToken(code);
  const content = await fetchJson(`${ORIGIN}/api/rekad-content?dialect=malan&type=sentence&stage=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const sentences = content.sentences ?? [];
  if (!Array.isArray(sentences) || sentences.length === 0) {
    throw new Error("No Rekad 1 sentences returned.");
  }

  const rows = sentences.map((sentence, index) => ({
    Lesson: LESSON,
    Section: IMPORT_SECTION,
    Order: index + 1,
    "Pair Tag": "",
    Amis: String(sentence.sentence ?? "").trim(),
    Zh: String(sentence.chineseTrans ?? "").trim(),
    Audio: sentence.audioUrl ?? "",
  }));

  const sectionRows = SECTION_SEED.map((section) => ({
    Lesson: LESSON,
    Section: section.section,
    "Section Subtitle": section.subtitle,
    Order: section.order,
  }));

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(SENTENCES_OUTPUT, toCsv(HEADERS, rows), "utf8");
  await writeFile(SECTIONS_OUTPUT, toCsv(SECTION_HEADERS, sectionRows), "utf8");

  console.log(`Wrote ${rows.length} sentence row(s) to ${path.relative(ROOT, SENTENCES_OUTPUT)}`);
  console.log(`Wrote ${sectionRows.length} section seed row(s) to ${path.relative(ROOT, SECTIONS_OUTPUT)}`);
  console.warn(`Section assignment note: ${path.basename(SENTENCES_OUTPUT)} uses "${IMPORT_SECTION}" because SashaWaves does not expose per-sentence section membership.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

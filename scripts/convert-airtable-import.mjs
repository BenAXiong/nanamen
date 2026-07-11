// Converts staged lesson content into the CSV shape expected by the Airtable
// `Sentences` table. Default input/output live under scratch/.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_INPUT = path.join(ROOT, "scratch", "content.txt");
const DEFAULT_OUTPUT = path.join(ROOT, "scratch", "airtable-import.csv");
const HEADERS = ["Lesson", "Section", "Order", "Pair Tag", "Amis", "Zh", "Audio"];

const HEADER_ALIASES = new Map([
  ["lesson", "Lesson"],
  ["lessontitle", "Lesson"],
  ["section", "Section"],
  ["sectiontitle", "Section"],
  ["order", "Order"],
  ["sortorder", "Order"],
  ["pairtag", "Pair Tag"],
  ["pair", "Pair Tag"],
  ["tag", "Pair Tag"],
  ["amis", "Amis"],
  ["text", "Amis"],
  ["prompt", "Amis"],
  ["zh", "Zh"],
  ["chinese", "Zh"],
  ["translation", "Zh"],
  ["audio", "Audio"],
  ["audiourl", "Audio"],
  ["audio_url", "Audio"],
]);

function usage() {
  return [
    "Usage:",
    "  node scripts/convert-airtable-import.mjs [input] [output] [--lesson \"Lesson 1\"] [--section \"Section 1\"]",
    "",
    `Defaults: ${path.relative(ROOT, DEFAULT_INPUT)} -> ${path.relative(ROOT, DEFAULT_OUTPUT)}`,
  ].join("\n");
}

function parseArgs(argv) {
  const args = { input: null, output: null, lesson: null, section: null };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--lesson") {
      args.lesson = argv[++i];
      continue;
    }
    if (arg === "--section") {
      args.section = argv[++i];
      continue;
    }
    positional.push(arg);
  }
  args.input = path.resolve(ROOT, positional[0] ?? DEFAULT_INPUT);
  args.output = path.resolve(ROOT, positional[1] ?? DEFAULT_OUTPUT);
  return args;
}

function normalizeHeader(header) {
  const key = String(header ?? "").toLowerCase().replace(/[^a-z0-9_]+/g, "");
  return HEADER_ALIASES.get(key) ?? null;
}

function normalizeLabel(prefix, value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return `${prefix} ${raw}`;
  const prefixed = new RegExp(`^${prefix}\\b`, "i");
  if (prefixed.test(raw)) return raw.replace(new RegExp(`^${prefix}\\b`, "i"), prefix);
  return raw;
}

function normalizePairTag(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = /^([QA])\s*(\d+)$/i.exec(raw);
  return match ? `${match[1].toUpperCase()}${Number(match[2])}` : raw;
}

function normalizeAudio(value, warnings, context) {
  if (Array.isArray(value)) {
    const first = value[0];
    return normalizeAudio(first?.url ?? first, warnings, context);
  }
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  warnings.push(`${context}: Audio "${raw}" is not a public URL; leaving Audio blank for CSV import.`);
  return "";
}

function makeRow(input, defaults, warnings, context) {
  const row = {
    Lesson: normalizeLabel("Lesson", input.Lesson ?? defaults.lesson),
    Section: normalizeLabel("Section", input.Section ?? defaults.section),
    Order: input.Order === undefined || input.Order === null || input.Order === "" ? "" : Number(input.Order),
    "Pair Tag": normalizePairTag(input["Pair Tag"]),
    Amis: String(input.Amis ?? "").trim(),
    Zh: String(input.Zh ?? "").trim(),
    Audio: normalizeAudio(input.Audio, warnings, context),
  };
  return row;
}

function looksDelimited(raw) {
  const firstLine = raw.split(/\r?\n/).find((line) => line.trim());
  if (!firstLine) return false;
  return /(^|,|\t|;)(Lesson|Section|Order|Pair Tag|Amis|Zh|Audio)(,|\t|;|$)/i.test(firstLine);
}

function detectDelimiter(headerLine) {
  const candidates = [",", "\t", ";"];
  return candidates
    .map((delimiter) => ({ delimiter, count: splitDelimitedLine(headerLine, delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function splitDelimitedLine(line, delimiter) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function parseDelimited(raw, defaults, warnings) {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const delimiter = detectDelimiter(lines[0]);
  const sourceHeaders = splitDelimitedLine(lines[0], delimiter).map(normalizeHeader);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = splitDelimitedLine(lines[i], delimiter);
    const input = {};
    for (let j = 0; j < sourceHeaders.length; j += 1) {
      if (sourceHeaders[j]) input[sourceHeaders[j]] = values[j] ?? "";
    }
    rows.push(makeRow(input, defaults, warnings, `line ${i + 1}`));
  }
  return rows;
}

function flattenGeneratedLessons(value) {
  const lessons = Array.isArray(value) ? value : value.lessons;
  if (!Array.isArray(lessons)) return null;
  const rows = [];
  for (const lesson of lessons) {
    for (const section of lesson.sections ?? []) {
      for (const sentence of section.sentences ?? []) {
        rows.push({
          Lesson: lesson.title,
          Section: section.title,
          Order: sentence.order,
          "Pair Tag": sentence.pairTag,
          Amis: sentence.amis,
          Zh: sentence.zh,
          Audio: sentence.audioUrl,
        });
      }
    }
  }
  return rows;
}

function parseJson(raw, defaults, warnings) {
  const value = JSON.parse(raw);
  const sourceRows = flattenGeneratedLessons(value) ?? (Array.isArray(value) ? value : value.rows ?? value.records);
  if (!Array.isArray(sourceRows)) throw new Error("JSON input must be an array, { rows: [...] }, { records: [...] }, or generated lessons JSON.");
  return sourceRows.map((entry, index) => {
    const fields = entry.fields ?? entry;
    return makeRow(fields, defaults, warnings, `JSON row ${index + 1}`);
  });
}

function parseDirective(line) {
  const heading = /^(#{1,6})\s+(.+)$/.exec(line);
  if (heading) {
    const level = heading[1].length;
    const value = heading[2].trim();
    if (/^lesson\b/i.test(value) || level === 1) return { type: "lesson", value };
    if (/^section\b/i.test(value) || level === 2) return { type: "section", value };
  }

  const labeled = /^(lesson|section)\s*:?\s*(.+)$/i.exec(line);
  if (labeled) return { type: labeled[1].toLowerCase(), value: labeled[2].trim() };

  const bracketed = /^\[(lesson|section)\s*:?\s*(.+)]$/i.exec(line);
  if (bracketed) return { type: bracketed[1].toLowerCase(), value: bracketed[2].trim() };

  return null;
}

function splitPlainRow(line) {
  const stripped = line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "").trim();
  if (stripped.includes("\t")) return stripped.split("\t").map((part) => part.trim());
  if (stripped.includes("|")) return stripped.split("|").map((part) => part.trim());
  return null;
}

function parsePlainText(raw, defaults, warnings) {
  let lesson = defaults.lesson ?? "";
  let section = defaults.section ?? "";
  const orderBySection = new Map();
  const rows = [];

  raw.split(/\r?\n/).forEach((sourceLine, index) => {
    const line = sourceLine.trim();
    if (!line || line.startsWith("//") || line.startsWith("<!--")) return;

    const directive = parseDirective(line);
    if (directive?.type === "lesson") {
      lesson = normalizeLabel("Lesson", directive.value);
      section = defaults.section ?? "";
      return;
    }
    if (directive?.type === "section") {
      section = normalizeLabel("Section", directive.value);
      return;
    }

    const parts = splitPlainRow(line);
    if (!parts || parts.length < 2) {
      warnings.push(`line ${index + 1}: skipped; expected "Pair Tag | Amis | Zh" or "Amis | Zh".`);
      return;
    }

    let pairTag = "";
    let amis = "";
    let zh = "";
    let audio = "";

    if (/^[QA]\s*\d+$/i.test(parts[0]) || parts[0] === "") {
      [pairTag, amis, zh = "", audio = ""] = parts;
    } else {
      [amis, zh = "", audio = ""] = parts;
    }

    const sectionKey = `${lesson}||${section}`;
    const nextOrder = (orderBySection.get(sectionKey) ?? 0) + 1;
    orderBySection.set(sectionKey, nextOrder);

    rows.push(makeRow(
      { Lesson: lesson, Section: section, Order: nextOrder, "Pair Tag": pairTag, Amis: amis, Zh: zh, Audio: audio },
      defaults,
      warnings,
      `line ${index + 1}`,
    ));
  });

  return rows;
}

function fillMissingOrder(rows) {
  const nextBySection = new Map();
  for (const row of rows) {
    const key = `${row.Lesson}||${row.Section}`;
    const next = nextBySection.get(key) ?? 1;
    if (row.Order === "") {
      row.Order = next;
      nextBySection.set(key, next + 1);
    } else {
      nextBySection.set(key, Math.max(next, Number(row.Order) + 1));
    }
  }
}

function validateRows(rows, warnings) {
  const pairsBySection = new Map();
  rows.forEach((row, index) => {
    const label = `row ${index + 1}`;
    if (!row.Lesson) warnings.push(`${label}: missing Lesson.`);
    if (!row.Section) warnings.push(`${label}: missing Section.`);
    if (!row.Amis) warnings.push(`${label}: missing Amis.`);
    if (row.Order !== "" && (!Number.isFinite(row.Order) || row.Order < 0)) warnings.push(`${label}: Order should be a non-negative number.`);
    if (row["Pair Tag"] && !/^[QA]\d+$/.test(row["Pair Tag"])) warnings.push(`${label}: Pair Tag "${row["Pair Tag"]}" should look like Q1 or A1.`);

    const pair = /^([QA])(\d+)$/.exec(row["Pair Tag"]);
    if (pair) {
      const key = `${row.Lesson}||${row.Section}||${pair[2]}`;
      const entry = pairsBySection.get(key) ?? {};
      const role = pair[1] === "Q" ? "question" : "answer";
      if (entry[role]) warnings.push(`${label}: duplicate ${row["Pair Tag"]} in ${row.Lesson} / ${row.Section}.`);
      entry[role] = true;
      pairsBySection.set(key, entry);
    }
  });

  for (const [key, entry] of pairsBySection) {
    if (!entry.question || !entry.answer) {
      const [lesson, section, number] = key.split("||");
      warnings.push(`${lesson} / ${section}: incomplete pair ${number} (${entry.question ? "missing A" : "missing Q"}${number}).`);
    }
  }
}

function toCsvValue(value) {
  const raw = String(value ?? "");
  if (/[",\r\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function toCsv(rows) {
  const lines = [HEADERS.join(",")];
  for (const row of rows) {
    lines.push(HEADERS.map((header) => toCsvValue(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const defaults = {
    lesson: args.lesson ? normalizeLabel("Lesson", args.lesson) : "",
    section: args.section ? normalizeLabel("Section", args.section) : "",
  };

  const raw = await readFile(args.input, "utf8").catch((err) => {
    if (err.code === "ENOENT") {
      throw new Error(`Input file not found: ${path.relative(ROOT, args.input)}\n\n${usage()}`);
    }
    throw err;
  });

  const trimmed = raw.trim();
  const warnings = [];
  let rows;
  if (!trimmed) {
    rows = [];
  } else if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    rows = parseJson(trimmed, defaults, warnings);
  } else if (looksDelimited(trimmed)) {
    rows = parseDelimited(trimmed, defaults, warnings);
  } else {
    rows = parsePlainText(trimmed, defaults, warnings);
  }

  fillMissingOrder(rows);
  validateRows(rows, warnings);

  await mkdir(path.dirname(args.output), { recursive: true });
  await writeFile(args.output, toCsv(rows), "utf8");

  console.log(`Wrote ${rows.length} row(s) to ${path.relative(ROOT, args.output)}`);
  if (warnings.length) {
    console.warn(`Warnings (${warnings.length}):`);
    for (const warning of warnings) console.warn(`  - ${warning}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

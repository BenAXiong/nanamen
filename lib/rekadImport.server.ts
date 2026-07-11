import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

const BASE_ID = "app8MvGUBu4Xg9HOR";
const TABLE_ID = "tbl0IiPCsGxOZAcBL";
const SASHAWAVES_ORIGIN = "https://sashawaves.com";

const FIELD = {
  amis: "fldf3FkHop0VAESgt",
  zh: "fldmRiYjgNGbZmq1T",
  lesson: "fld4yxPbhZVjoGloQ",
  section: "fldno1ijNa7j5RjsL",
  order: "fldWlCopIRNPrFQbC",
  audio: "fldAuhWjtoR8w7TVS",
  pairTag: "fldycoz7nks3aFw5l",
};

type SashaWavesSentence = {
  sentence: string;
  chineseTrans: string;
  audioUrl: string;
};

export type ManualConfig = {
  lesson: string;
  classDate: string;
  sectionTitles: Record<string, string>;
  sections: Record<string, number | number[]>;
};

export type ImportResult =
  | { status: "unavailable"; lessonNumber: number }
  | {
      status: "imported";
      lessonNumber: number;
      lessonName: string;
      count: number;
      sectioned: number;
      unsectioned: number;
      usedConfig: boolean;
    }
  | { status: "error"; message: string };

// Every sentence's Lesson field is a single-select string like "Rekad 1 - 26/05/27"
// or (before a class date is set) just "Rekad 1". We only need the number.
function parseRekadNumber(lessonName: string): number | null {
  const match = /^Rekad\s+(\d+)/i.exec(lessonName.trim());
  return match ? Number(match[1]) : null;
}

async function getMaxRekadNumber(readKey: string): Promise<number> {
  let max = 0;
  let offset: string | undefined;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    url.searchParams.set("fields[]", "Lesson");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${readKey}` } });
    if (!res.ok) throw new Error(`Airtable read failed: ${res.status} ${await res.text()}`);
    const body = await res.json();
    for (const record of body.records) {
      const n = parseRekadNumber(record.fields.Lesson ?? "");
      if (n !== null && n > max) max = n;
    }
    offset = body.offset;
  } while (offset);
  return max;
}

async function sashaWavesAuth(code: string): Promise<string> {
  const res = await fetch(`${SASHAWAVES_ORIGIN}/api/rekad-auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const body = await res.json();
  if (!res.ok || !body?.success || !body?.token) {
    throw new Error("SashaWaves activation failed.");
  }
  return body.token;
}

async function fetchSashaWavesSentences(token: string, stage: number): Promise<SashaWavesSentence[]> {
  const res = await fetch(
    `${SASHAWAVES_ORIGIN}/api/rekad-content?dialect=malan&type=sentence&stage=${stage}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`SashaWaves content fetch failed: ${res.status}`);
  const body = await res.json();
  return body.sentences ?? [];
}

export async function readManualConfig(lessonNumber: number): Promise<ManualConfig | null> {
  const configPath = path.resolve(process.cwd(), "scratch", `lesson-${lessonNumber}-manual-config.json`);
  try {
    const raw = await readFile(configPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// config.sections maps a section name to one Order number or several -- flip
// it into order -> section name for quick lookup while building records.
function buildOrderToSectionMap(config: ManualConfig): Map<number, string> {
  const map = new Map<number, string>();
  for (const [sectionName, orders] of Object.entries(config.sections ?? {})) {
    const list = Array.isArray(orders) ? orders : [orders];
    for (const order of list) map.set(order, sectionName);
  }
  return map;
}

async function createAirtableRecords(
  records: { fields: Record<string, unknown> }[],
  writeKey: string,
): Promise<void> {
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${writeKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ typecast: true, records: batch }),
    });
    if (!res.ok) {
      throw new Error(`Airtable write failed: ${res.status} ${await res.text()}`);
    }
  }
}

async function updateAirtableRecords(
  records: { id: string; fields: Record<string, unknown> }[],
  writeKey: string,
): Promise<void> {
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${writeKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ typecast: true, records: batch }),
    });
    if (!res.ok) {
      throw new Error(`Airtable update failed: ${res.status} ${await res.text()}`);
    }
  }
}

export type LessonSentence = {
  id: string;
  order: number;
  amis: string;
  zh: string;
  section: string | null;
  pairTag: string | null;
};

async function fetchAllRecords(readKey: string): Promise<
  { id: string; fields: Record<string, unknown> }[]
> {
  const result: { id: string; fields: Record<string, unknown> }[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${readKey}` } });
    if (!res.ok) throw new Error(`Airtable read failed: ${res.status} ${await res.text()}`);
    const body = await res.json();
    result.push(...body.records);
    offset = body.offset;
  } while (offset);
  return result;
}

export async function getLessonSentences(lessonNumber: number): Promise<LessonSentence[]> {
  const readKey = process.env.AIRTABLE_API_KEY;
  if (!readKey) throw new Error("Missing AIRTABLE_API_KEY in .env.local");

  const records = await fetchAllRecords(readKey);
  const result: LessonSentence[] = [];
  for (const record of records) {
    if (parseRekadNumber((record.fields.Lesson as string) ?? "") === lessonNumber) {
      result.push({
        id: record.id,
        order: (record.fields.Order as number) ?? 0,
        amis: (record.fields.Amis as string) ?? "",
        zh: (record.fields.Zh as string) ?? "",
        section: (record.fields.Section as string) ?? null,
        pairTag: (record.fields["Pair Tag"] as string) ?? null,
      });
    }
  }
  return result.sort((a, b) => a.order - b.order);
}

export async function getMaxRekadNumberPublic(): Promise<number> {
  const readKey = process.env.AIRTABLE_API_KEY;
  if (!readKey) throw new Error("Missing AIRTABLE_API_KEY in .env.local");
  return getMaxRekadNumber(readKey);
}

export type RekadLesson = { number: number; name: string };

export async function getAllRekadLessons(): Promise<RekadLesson[]> {
  const readKey = process.env.AIRTABLE_API_KEY;
  if (!readKey) throw new Error("Missing AIRTABLE_API_KEY in .env.local");

  const records = await fetchAllRecords(readKey);
  const byNumber = new Map<number, string>();
  for (const record of records) {
    const lessonName = (record.fields.Lesson as string) ?? "";
    const n = parseRekadNumber(lessonName);
    if (n !== null) byNumber.set(n, lessonName);
  }
  return [...byNumber.entries()]
    .map(([number, name]) => ({ number, name }))
    .sort((a, b) => a.number - b.number);
}

export type SectionEntry = { name: string; title: string; order: number | null };

export type ApplySectionsResult =
  | { status: "ok"; sectioned: number; renamedLesson: boolean }
  | { status: "error"; message: string };

export async function applySectionsToLesson(
  lessonNumber: number,
  classDate: string,
  entries: SectionEntry[],
): Promise<ApplySectionsResult> {
  const writeKey = process.env.AIRTABLE_WRITE_KEY;
  if (!writeKey) return { status: "error", message: "Missing AIRTABLE_WRITE_KEY in .env.local" };

  const sentences = await getLessonSentences(lessonNumber);

  const updatesById = new Map<string, Record<string, unknown>>();
  const setField = (id: string, field: string, value: unknown) => {
    updatesById.set(id, { ...(updatesById.get(id) ?? {}), [field]: value });
  };

  // Each entry's order is where that section *starts* -- it runs up to the
  // next entry's start (by order), and the last one runs to the end of the
  // lesson. So Sakacecay=1, Sakatosa=11 means Sakacecay covers 1-10, not just
  // sentence 1.
  const ranges = entries
    .filter((e): e is SectionEntry & { order: number } => e.order !== null)
    .sort((a, b) => a.order - b.order);

  let sectioned = 0;
  for (let i = 0; i < ranges.length; i++) {
    const entry = ranges[i];
    const start = entry.order;
    const end = i + 1 < ranges.length ? ranges[i + 1].order : Infinity;
    const sectionValue = entry.title ? `${entry.name} - ${entry.title}` : entry.name;
    for (const sentence of sentences) {
      if (sentence.order >= start && sentence.order < end) {
        setField(sentence.id, FIELD.section, sectionValue);
        sectioned += 1;
      }
    }
  }

  const renamedLesson = classDate.trim().length > 0;
  if (renamedLesson) {
    const newLessonName = `Rekad ${lessonNumber} - ${classDate.trim()}`;
    for (const sentence of sentences) setField(sentence.id, FIELD.lesson, newLessonName);
  }

  const updates = [...updatesById.entries()].map(([id, fields]) => ({ id, fields }));
  await updateAirtableRecords(updates, writeKey);

  await writeManualConfig(lessonNumber, classDate, entries);

  return { status: "ok", sectioned, renamedLesson };
}

async function writeManualConfig(lessonNumber: number, classDate: string, entries: SectionEntry[]): Promise<void> {
  const configPath = path.resolve(process.cwd(), "scratch", `lesson-${lessonNumber}-manual-config.json`);
  const config: ManualConfig = {
    lesson: `Rekad ${lessonNumber}`,
    classDate,
    sectionTitles: Object.fromEntries(entries.map((e) => [e.name, e.title])),
    sections: Object.fromEntries(
      entries.filter((e) => e.order !== null).map((e) => [e.name, e.order as number]),
    ),
  };
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2));
}

export type SaveResult = { status: "ok"; updated: number } | { status: "error"; message: string };

export async function saveSentenceEdits(
  edits: { id: string; amis: string; zh: string }[],
): Promise<SaveResult> {
  const writeKey = process.env.AIRTABLE_WRITE_KEY;
  if (!writeKey) return { status: "error", message: "Missing AIRTABLE_WRITE_KEY in .env.local" };
  if (edits.length === 0) return { status: "ok", updated: 0 };

  const records = edits.map((e) => ({
    id: e.id,
    fields: { [FIELD.amis]: e.amis, [FIELD.zh]: e.zh },
  }));
  await updateAirtableRecords(records, writeKey);
  return { status: "ok", updated: records.length };
}

export async function savePairTags(
  edits: { id: string; pairTag: string | null }[],
): Promise<SaveResult> {
  const writeKey = process.env.AIRTABLE_WRITE_KEY;
  if (!writeKey) return { status: "error", message: "Missing AIRTABLE_WRITE_KEY in .env.local" };
  if (edits.length === 0) return { status: "ok", updated: 0 };

  const records = edits.map((e) => ({
    id: e.id,
    fields: { [FIELD.pairTag]: e.pairTag },
  }));
  await updateAirtableRecords(records, writeKey);
  return { status: "ok", updated: records.length };
}

export async function checkAndImportNextLesson(): Promise<ImportResult> {
  const readKey = process.env.AIRTABLE_API_KEY;
  const writeKey = process.env.AIRTABLE_WRITE_KEY;
  const rekadCode = process.env.SASHAWAVES_REKAD_CODE;
  if (!readKey || !writeKey || !rekadCode) {
    return {
      status: "error",
      message: "Missing AIRTABLE_API_KEY, AIRTABLE_WRITE_KEY, or SASHAWAVES_REKAD_CODE in .env.local",
    };
  }

  const currentMax = await getMaxRekadNumber(readKey);
  const nextNumber = currentMax + 1;

  const authToken = await sashaWavesAuth(rekadCode);
  const sentences = await fetchSashaWavesSentences(authToken, nextNumber);
  if (sentences.length === 0) {
    return { status: "unavailable", lessonNumber: nextNumber };
  }

  const config = await readManualConfig(nextNumber);
  const orderToSection = config ? buildOrderToSectionMap(config) : new Map<number, string>();
  const lessonName =
    config?.classDate ? `Rekad ${nextNumber} - ${config.classDate}` : `Rekad ${nextNumber}`;

  let sectioned = 0;
  const records = sentences.map((s, index) => {
    const order = index + 1;
    const sectionName = orderToSection.get(order);
    const fields: Record<string, unknown> = {
      [FIELD.amis]: s.sentence,
      [FIELD.zh]: s.chineseTrans,
      [FIELD.lesson]: lessonName,
      [FIELD.order]: order,
      [FIELD.pairTag]: s.sentence.includes("?") ? "Q" : "A",
    };
    if (s.audioUrl) fields[FIELD.audio] = [{ url: s.audioUrl }];
    if (sectionName && config) {
      const title = config.sectionTitles?.[sectionName];
      fields[FIELD.section] = title ? `${sectionName} - ${title}` : sectionName;
      sectioned += 1;
    }
    return { fields };
  });

  await createAirtableRecords(records, writeKey);

  return {
    status: "imported",
    lessonNumber: nextNumber,
    lessonName,
    count: records.length,
    sectioned,
    unsectioned: records.length - sectioned,
    usedConfig: config !== null,
  };
}

# Scratch content import area

Put source content here when preparing an Airtable batch import.

Default input:

```bash
scratch/content.txt
```

Run:

```bash
npm run content:airtable-import
```

Default output:

```bash
scratch/airtable-import.csv
```

The CSV headers match the Airtable `Sentences` table:

```csv
Lesson,Section,Order,Pair Tag,Amis,Zh,Audio
```

For plain text input, use headings plus pipe- or tab-separated rows:

```text
# Lesson 1
## Section 1
Q1 | Amis question text | Chinese translation
A1 | Amis answer text | Chinese translation
   | Exposure-only Amis text | Chinese translation
```

`Audio` can only be imported from CSV when it is a public URL. Local audio files should be uploaded to Airtable after import, or added as public URLs before conversion.

## Per-lesson manual config

After a batch import lands ~50 sentences with no `Section` assigned yet (Section
is left blank for anything not manually sorted -- see `docs/adr/DEC-CONTENT01`),
add a `scratch/lesson-N-manual-config.json` (tracked in git, not ignored) with:

```json
{
  "lesson": "Rekad N",
  "classDate": "YY/MM/DD",
  "sections": {
    "Sakacecay": 1,
    "Sakatolo": [3, 27]
  }
}
```

This is real data, not a placeholder -- fill in the actual class date and which
`Order` number(s) from the import CSV belong in each section, then ask Claude to
apply it: Section gets set to `"<key> - <title>"` (titles from the matching
`lesson-N-section-seed.csv`) for exactly those rows, Lesson gets renamed to
`"<lesson> - <classDate>"` across the whole lesson, everything else stays blank.

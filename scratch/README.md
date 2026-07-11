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

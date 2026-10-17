# Source inventory and publication gate

`ready` / `consumed` describe bundle transport and persistence. They do not
certify textbook completeness. `curriculumCoverage.status` separately reports
`unverified`, `partial`, `blocked`, or `complete`.

New catalog entries start as `draft`, including an empty PostgreSQL catalog.
The admin publication route refuses `published` until the server-produced
coverage report is complete. The database update also guards the stored metadata.
Existing publication decisions are not silently changed. No database migration
is required: the report uses the existing JSON metadata column.

## Create evidence

Review the original textbook page by page. Include appendices, source exercises,
all subparts and non-quiz content. Use stable item IDs and the most specific
available `sourceRef`; do not derive source counts from the existing course.
Mark `verified: true` only after actual review. The structural validator cannot
perform semantic comparison with the PDF or independently certify a review flag.

Pass `sourceInventory` in Course Bundle v1, or as an optional argument to
`finalize_course_bundle`. It survives bundle validation and is retained in the
stored import result. An absent inventory remains `unverified`; missing pages,
items, destinations, or question mappings produce diagnostics.

```json
{
  "version": 1,
  "pages": [
    { "fileName": "synthetic.pdf", "pageNumber": 1, "status": "reviewed" }
  ],
  "items": [
    {
      "id": "word-1",
      "lessonId": 1,
      "kind": "vocabulary",
      "fileName": "synthetic.pdf",
      "pageNumber": 1,
      "sourceRef": "synthetic.pdf · p.1 · word-1",
      "contentPointer": "/vocabulary/0",
      "practiceMethod": "questions",
      "practiceQuestionIds": ["q-word-1"],
      "verified": true
    }
  ]
}
```

This is a synthetic shape example, not a textbook fixture. Every source page
must appear exactly once. An unavailable page uses `status: "unavailable"`
and a reason; it keeps the report incomplete instead of being dropped.

`contentPointer` is a JSON pointer relative to the lesson. Supported roots are
the runtime learning sections and the lesson's filtered `questions` array.
Use a distinct destination for each source unit; `/grammar/0/examples/1` and
`/extraSections/0/content/2` can identify original examples and exercise subparts.
`practiceMethod: "workbook"` preserves open-ended/manual activities without
inventing answer keys. Question mappings must point to real questions in the
same lesson with the matching source reference. Added questions can carry
`origin: "derived"`; legacy origin remains unknown.

The three coverage ratios measure representation, practice availability, and
reviewed items independently. A complete report means structural reconciliation
with the **submitted reviewed inventory**. It does not prove that an incomplete
inventory magically contains every fact in the book.

## PDF and DOCX

PDF retains physical page indices. Failed pages remain in the page inventory
with `extractionIssues`; later pages and OCR batches continue. OCR failures retain
source snapshots/previews and require review. OCR confidence is not fabricated.

DOCX is parsed locally with Mammoth. Paragraphs, lists, tables, images, links and
conversion warnings are retained as logical source blocks. Block count is not a
printed page count. `sourceLocation` explicitly labels this distinction and is
included in MCP source output and API compilation batches. Converted HTML is
never inserted into the live document; external file access is disabled.
Headers, footers, unsupported drawings/layout and other converter limitations
still require checking the original DOCX; inspect conversion warnings and do
not claim complete source fidelity from extraction alone.

## Run locally

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `/import`, choose PDF/DOCX, and inspect source/extraction warnings. Use a
connected authenticated Haneul Learning Bridge, or export a handoff and import
the authored bundle in the advanced manual recovery controls. That path does
not require a personal AI API key. Automatic authoring still requires an actual
connected compiler; the application does not simulate one.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
node --test scripts/audit-curriculum-fidelity.test.mjs
```

E2E launches the production build on port 3107 with an isolated `.haneul/e2e-runtime`
directory, empty database/provider settings and an ephemeral local MCP token. It
never reuses an arbitrary already-running server. Standard tests do not require
private textbooks. To opt in to read-only validation of existing exports, set
`HANEUL_REGRESSION_LIBRARY` to the course library and run
`pnpm exec vitest run src/lib/imported-library-regression.test.ts`.

Persistent runtime volumes may use `HANEUL_IMPORT_DIR`, `HANEUL_EVENT_DIR`,
`HANEUL_COURSE_LIBRARY`, and `HANEUL_ACTIVE_COURSE_FILE`. `.haneul` and `.env`
files are excluded from deployment traces. Supply runtime storage separately.

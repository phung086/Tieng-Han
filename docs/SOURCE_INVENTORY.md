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
    { "fileName": "synthetic.pdf", "pageNumber": 1, "status": "reviewed", "classification": "learning-content" }
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
      "motif": "input",
      "practiceQuestionIds": ["q-word-1"],
      "verified": true
    }
  ]
}
```

This is a synthetic shape example, not a textbook fixture. Every source page
must appear exactly once. An unavailable page uses `status: "unavailable"`
and a reason; it keeps the report incomplete instead of being dropped.
Every reviewed learning page must use `classification: "learning-content"` and
have its individual source units inventoried. A page genuinely containing no
learning content uses `classification: "non-learning"` and an explicit review
reason. Merely marking hundreds of pages `reviewed` with no unit inventory can
no longer yield complete coverage. Legacy inventories without classification
remain readable but require review before publication.
Coverage reports carry the current `CURRICULUM_AUDIT_VERSION`. The publication API and database guard
require that exact version as well as `complete`; a cached success report from older
rules cannot authorize a new publication. Existing published course statuses are
not changed by this guard.

`contentPointer` is a JSON pointer relative to the lesson. Supported roots are
the runtime learning sections and the lesson's filtered `questions` array.
Use a distinct destination for each source unit; `/grammar/0/examples/1` and
`/extraSections/0/content/2` can identify original examples and exercise subparts.
`practiceMethod: "workbook"` preserves open-ended/manual activities without
inventing answer keys. Question mappings must point to real questions in the
same lesson with the matching source reference. For `practiceMethod: "questions"`,
`motif` is required and must be one of `choice`, `input`, or `reorder`;
at least one mapped question must use that form or practice coverage remains
incomplete. Omit `motif` only when the source activity is intentionally retained
as a manually reviewed workbook task.
Added questions can carry `origin: "derived"`; legacy origin remains unknown.

The three coverage ratios measure representation, practice availability, and
reviewed items independently. A complete report means structural reconciliation
with the **submitted reviewed inventory**. It does not prove that an incomplete
inventory magically contains every fact in the book.

## Full original source and strict authoring batches

`/sources` reads the active course's original import snapshots one declared page
at a time. All declared pages, including appendices, remain addressable; missing
or corrupt snapshots are displayed as unavailable, never skipped. PDF indices
are physical file positions and may differ from printed page numbers. DOCX uses
logical block labels. Images, extracted text, embedded images and resource links
are retained separately from authored knowledge. Database-backed access follows
the course publication rules; local testing uses the existing local-first mode.

Both generation and QA reject oversized text/image requests with HTTP 413.
Callers must split and process subsequent batches; neither API slices away the
final pages or images. Every QA finding is retained. QA must report 100 for both
scores, no missing units, no issues, and `pass: true`; the client enforces the
same rule after repair. AI scores alone still leave the course unverified.
Independent source inventory remains necessary for publication.

Generated batches retain every extracted source character in labelled
`extraSections` of kind `source-transcript`. These are fallback copies, excluded
from authored-item coverage. Independent direct-generation lessons continue if
another lesson fails; valid results remain a partial draft with explicit errors.
No source-less lesson is silently omitted. This does not provide a distributed
authoring worker or durable direct-generation checkpoints.

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

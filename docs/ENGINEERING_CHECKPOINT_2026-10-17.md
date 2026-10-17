# Haneul engineering checkpoint — 2026-10-17

This is a delivered engineering increment, **not final certification of the full
development brief or of textbook completeness**.

## Completed code and integration

- Started from fetched main `75c5209` on `integration/haneul-full-curriculum`.
- Audited 48 remote development refs, all 31 PRs, local branches and 3 worktrees.
  See [branch decisions](BRANCH_INTEGRATION_MATRIX.md) and the detailed JSON matrix.
- Retained useful work from open PRs #25, #26, #27 and #29 using targeted
  cherry-picks with `-x` provenance. Kept newer main behavior when old session
  changes overlapped. Preserved additional item-anchor, inventory parity,
  source-sized compiler regression and filename-hint work from other branches.
- Added strict source-manifest, document/page identity and range checks.
  Repeated uploads do not inflate completeness; every declared snapshot is
  checked before queue/finalization. Store-level submission revalidates shape,
  exact fingerprints and language, and cannot overwrite a locked result.
- Reject malformed nested content, duplicate IDs, invalid question arrays and
  silently filtered manifest rows. Batch compilation validates raw output
  before normalization. Dialogue-line provenance survives normalization,
  workbook generation, drills and coverage auditing.
- Corrupt drafts/checkpoints are isolated with diagnostics; independent lessons
  remain resumable. Finalization refuses hidden draft exclusions and unfinished
  checkpoints. Automatic stale-job retries stop after three; manual recovery
  retains saved drafts.
- Added local DOCX body/block extraction with text/table/image/link retention,
  explicit logical source locations and converter warnings. PDF page and OCR
  batch failures retain their page records and allow later work to continue.
- Added optional reviewed `sourceInventory` input, three independent coverage
  ratios and explicit derived-question origin. Page gaps make source percentage
  unknown. Reports persist with the import job and runtime course metadata.
  Admin publication rejects incomplete/unverified inventories. New database
  catalog entries start as drafts; existing publication states are preserved.
- Lesson UI displays observed counts and uncertainty separately from core
  learning progress. Analytics includes unstarted lessons and excludes removed
  lesson IDs. Desktop/mobile layouts were inspected in the real browser.
- Fixed the frozen lockfile, isolated E2E storage/provider settings, and excluded
  private runtime data and environment files from deployment traces.

Important commits: `9b0869e` (lockfile/Next configuration), `0ba7e15` (source
integrity, recovery, DOCX, inventory gate), `253d04a` (retained compiler regression),
`99ac37d` / `fc8c5ab` (retained filename hint and tests). The final follow-up commit
contains documentation, integration decisions and the source-level hint fix.

## Verification evidence

| Check | Observed result |
|---|---|
| Frozen dependency installation | Passed |
| ESLint | Passed |
| TypeScript | Passed |
| Vitest | 152 passed, 1 private-data test skipped in the normal suite |
| Opt-in private course regression | 1 passed; reads all 4 existing courses / 60 lessons without truncating collections |
| Audit CLI regression | 3 passed |
| Production build | Passed; 43 routes, no dynamic filesystem tracing warnings in the final build |
| Production Playwright | 20 passed across desktop and mobile |
| Source storage audit | 4 courses / 60 lessons; `unverified`, 0 structural issues, 121 warnings |
| Git conflict/whitespace check | No unresolved conflict entries; whitespace corrected |

E2E includes a 131-block DOCX upload and the real HTTP/MCP workflow: create job,
upload snapshots, queue, prepare, save lesson draft, read progress, submit reviewed
inventory, finalize, consume, reload course, and open practice. These use clearly
synthetic source material and no AI provider key. They do not prove authorship
accuracy on a real textbook. Existing learner tests check actual answer feedback,
resume behavior, lesson unlocking and responsive routes.

Private-data validation was opt-in against the primary checkout's course
exports. The actual source coverage table is in
[CURRICULUM_COVERAGE_CHECKPOINT.md](CURRICULUM_COVERAGE_CHECKPOINT.md).

Browser evidence is local/private under `.haneul/reports/`: before/after lesson,
import and statistics captures at 1440px and 393px. No horizontal overflow or
page errors were observed in those six final route/viewport combinations.
The design detector reported six existing style warnings (width transition and
accent borders); the incumbent visual system was preserved.

## Not completed or not verified

- None of the four real courses has an independently reviewed item inventory.
  No 100% source, practice or validation claim is made for them. The priority
  Sơ cấp 1 source has 380 snapshots; its stored course has 15 lessons, 152 words
  and 90 questions. Source totals and appendices still need actual reconciliation.
- The connected remote Haneul Learning Bridge returned HTTP 401 / authentication
  required. Read-only local exports were used; the remote system was not mutated.
- No live PostgreSQL instance or migration was exercised in this worktree. The
  admin release gate was tested through the route with mocked persistence;
  real database behavior still needs staging validation. Existing migrations
  were inventoried, and this increment adds no migration.
- DOCX conversion is not a Word layout engine. Headers/footers, unsupported
  drawing/layout semantics and low-confidence source interpretation require
  original-document review. OCR confidence is not invented.
- Multi-process job leasing, durable scheduled authoring, dead-letter handling
  and crash recovery across multiple workers are not implemented by the current
  local JSON queue. Existing scheduled GitHub workflow audits; it is not an AI
  coding worker. No claim of continuous background development is made.
- Two other worktrees contain extensive owner changes that are not committed.
  Their worksheet/notebook, Docker, monitor and learner-flow code remains intact
  and requires its own stable integration review. No changes were reset, moved
  or discarded there.
- The old source PRs remain open unless GitHub separately records their merge.
  Their retained functionality is integrated through this branch; cherry-picking
  does not itself mark those PRs merged.

## Next concrete work

1. Review every page/item of Sơ cấp 1, starting with the eight low-text pages and
   appendices, and supply a real `sourceInventory`. Recompile missing content
   in a new job while retaining the existing consumed course.
2. Validate the new admin publication guard with PostgreSQL on staging, without
   changing live learner state or publication decisions blindly.
3. Review a stable snapshot of the two dirty worktrees and integrate their valid
   worksheet/notebook and workflow changes with combined regressions.
4. Add worker leasing and bounded retry scheduling if unattended authoring is
   required. Re-authenticate the bridge before any remote compilation.

Run/upload and inventory instructions are in [SOURCE_INVENTORY.md](SOURCE_INVENTORY.md).
The pull request and actual merge outcome are recorded in the chat handoff;
creating a PR alone is not treated as a successful merge.

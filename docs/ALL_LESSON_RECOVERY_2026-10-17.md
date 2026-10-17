# All-lesson source recovery — 2026-10-17

This delivery corrects the previous one-lesson focus. It does **not** certify full
textbook authorship. All four courses remain `partial`; preserving a page is not
equivalent to authoring and independently validating its knowledge units.

## Observed local content changes

The four exact original PDFs were found in the user's Downloads folder, matched
to their existing course filenames/page counts, hashed and copied to the private
data directory. Course IDs, lesson IDs, all 609 previously stored vocabulary IDs,
and all 646 stored questions were retained. Source grammar corrections keep
matching pattern IDs; unmatched previous grammar remains in full course backups.

| Course | Lessons processed | Vocabulary before → after | Grammar patterns | Examples before → after |
|---|---:|---:|---:|---:|
| Sơ cấp 1 | 15 | 195 → 1,018 | 47 → 52 | 113 → 196 |
| Sơ cấp 2 | 15 | 284 → 746 | 46 → 46 | 103 → 277 |
| Tổng hợp 3 | 15 | 70 → 977 | 50 → 50 | 50 → 360 |
| SBT bổ trợ Sơ cấp 2 | 15 | 60 → 60 | 46 → 46 | 46 → 46 |

Counts describe stored entries, including retained legacy material and multiple
source glosses. They are not independently established textbook coverage totals.

- Sơ cấp 1: reconstructs source vocabulary and full grammar explanations across
  every lesson; fixes omitted/misassigned patterns, including lessons 2, 5, 7,
  10, 11, 12 and 15. Complex table cells and visual tasks retain review issues.
- Sơ cấp 2: all 362 scan pages were OCR-processed locally. The author directly
  compared vocabulary lists and grammar pages against original saved images
  across all 15 lessons. Private reviewed data contains 740 vocabulary/expression
  entries and 46 patterns / 277 examples. Duplicate source occurrences retain
  provenance. Supplemental Vietnamese meanings for Korean-only body labels are
  labelled derived; OCR is not used as automatic verification.
- Tổng hợp 3: the old extraction and previews omitted Korean glyphs. Original-PDF
  extraction recovers the Korean text, bilingual vocabulary tables, explanations
  and examples for all 15 lessons, including cross-page grammar continuations.
- SBT: retains original chapter tasks/subparts for every lesson and appendix
  columns. It does not invent a vocabulary chapter that the workbook lacks.

The source API returned **1,171/1,171** complete saved page snapshots matching
disk, with **1,171/1,171** page previews after recovery. Before recovery, 312
previews were absent. This verifies transport and preservation, not semantic
completeness. OCR confidence and unresolved cells remain explicit.

Original activities and appendix blocks are exposed by skill in the workbook,
with unreviewed transcripts kept outside authored-practice progress. A link from
each lesson opens its complete workbook. The lesson summary now displays the
entire available practice bank instead of only the old stored sample questions.

## Verification

- ESLint, TypeScript, production build passed.
- 172 Vitest tests passed with the private four-course regression enabled.
- 6 local launcher tests passed.
- 9 Python recovery tests and 3 reviewed-unit application tests passed.
- 20 production Playwright E2E tests passed locally, desktop and mobile, including
  the full-bank count and complete workbook link.
- Browser observed Sơ cấp 1 lesson 15 with 62 words, 3 grammar patterns and
  161 practice questions; workbook contains 197 practice records, separately
  labelled original tasks/appendices and source fallback. These are runtime
  counts, not textbook completeness ratios.

Private per-lesson evidence and backups are stored in the configured data
directory under `review/all-lessons-runtime-verification.json`,
`review/all-lessons-coverage.csv`, and timestamped recovery folders. Private
textbook content is not included in Git.

## Remaining work

Reconcile each original exercise, subpart, listening transcript/answer, passage,
visual unit and appendix assignment against a genuinely independent inventory.
Complete semantic review of extracted table pairs and OCR; do not use empty
issue arrays as proof. Some legacy sample questions/readings remain unverified
and need correction against the source. Original CD audio is still unavailable.
No production PostgreSQL persistence or autonomous authoring worker was tested.

Reproduction commands and review application schema:
[ALL_LESSON_RECOVERY.md](ALL_LESSON_RECOVERY.md).

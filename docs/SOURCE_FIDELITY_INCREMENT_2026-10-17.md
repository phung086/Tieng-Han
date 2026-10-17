# Source fidelity test increment — 2026-10-17

This increment does not certify complete authorship of any textbook. The real
source comparison confirmed that the earlier material was incomplete.

## Code delivered

- Generation and QA reject oversized batches instead of silently cutting the
  final text or images. Every QA finding and repair note is retained. QA must
  report no omissions, no issues, true pass and full scores; that remains an AI
  assessment and cannot replace independent inventory review.
- Each generated batch retains its full extracted page text in a separately
  labelled fallback. These copies cannot satisfy authored-item coverage and
  are excluded from workbook practice progress.
- Every reviewed learning page needs unit inventory. Excluding a non-learning
  page requires an explicit reason. Merely checking pages as reviewed is
  insufficient. Independent direct-generation lessons continue after a failure;
  saved valid lessons are explicitly partial, with the failed lessons listed.
  Publication also requires the current audit version; cached complete reports
  produced under older rules cannot authorize a new publication.
- `/sources` exposes every declared original import page, including appendices,
  with full extracted text, saved page images, embedded images and links. Missing
  or damaged pages remain visible failures. Access follows course visibility;
  request paths cannot select arbitrary files or another course's source.
- Lesson/workbook screens expose the source comparison link, retain uncertainty,
  and show loading before course hydration instead of a false missing lesson.

## Observed private test data

All work used `.haneul/fidelity-test`; primary checkout data was read only.
No private textbook content, snapshots or learner state is included in Git.

| Imported source | Snapshots copied and returned intact | Saved page previews |
|---|---:|---:|
| Sơ cấp 1 | 380 | 223 |
| Sơ cấp 2 | 362 | 362 |
| Tổng hợp 3 | 338 | 244 |
| SBT bổ trợ Sơ cấp 2 | 91 | 30 |
| Total | 1,171 | 859 |

Every copied snapshot was byte-hash checked against the existing source store.
Every page was subsequently fetched through the new runtime API and compared
against its complete original snapshot. These checks establish preservation of
the stored extraction; they cannot establish that the original PDF extraction
captured every visual or word. There are 312 pages without saved previews, and
original PDFs were not found under the inspected primary project directory.

Lesson 1 Sơ cấp 1 previously retained 12 vocabulary items. Manual comparison of
the four explicit vocabulary lists on physical PDF pages 34, 35 and 52 identified
55 entries: 16 countries, 10 professions, 6 greetings and 23 end-of-lesson words.
The isolated test copy now contains all 55, with individual provenance, plus
3 grammar patterns / 15 source examples, 5 model dialogues / 14 lines, and
22 original answerable exercises keyed against appendix pages 348–349.
The full chapter extraction (pages 33–52) and Lesson 1 appendix text slices at
334, 348 and 349 remain available separately. Original activities without a
reliable extracted answer are preserved without invented grading.

The learner workbook displays 153 current practice records and 20 separately
labelled fallback page transcripts. Neither number is a textbook coverage total.
The course remains `partial`; other courses remain `unverified`. A partial
review bundle is stored locally for continuation, not publication.

## Verification

- ESLint, TypeScript and production build passed.
- Vitest: 170 passed, one private-data test skipped by default. With the actual
  isolated four-course library enabled: all 171 tests passed.
- Audit CLI regression: 3 passed.
- HTTP: all 1,171 declared page snapshots returned intact; lesson, workbook and
  source comparison routes returned 200.
- Real in-app browser: confirmed 55 visible vocabulary controls, source page
  380/380 accessible, and separated workbook counts/warning. Source comparison
  and workbook inspected at mobile size; no horizontal overflow was observed.
  Lesson/source desktop and mobile evidence is stored under `.haneul/reports`.
  No browser console errors were observed in the checked session.
- The production Playwright fixture now requires inventory on both source
  pages and exercises source navigation. This increment's local Playwright
  suite has not yet been run; CI evidence must be reported separately.

## Remaining work / next concrete step

Review every remaining source unit, starting with all original Lesson 1 exercise
subparts, listening appendix mappings, visual tasks and the additional reading
passages, then continue chapter by chapter across all four books. Reconstruct
missing previews from exact original PDFs when available. Original CD audio is
not present in the imported store; TTS is derived practice, not original audio.
Keep source, practice and independent review coverage separate; do not publish
a completion claim from preserved pages or self-reported AI scores.

Live AI authoring, production PostgreSQL, distributed worker leasing and durable
direct-generation checkpoints were not exercised or added in this increment.

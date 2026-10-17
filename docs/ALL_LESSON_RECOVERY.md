# Recover every imported lesson from original PDFs

The local library can contain every lesson ID while retaining only a few sample
words. A library/API equality check verifies transport, not textbook authorship.
Do not use that check or OCR confidence as a completion certificate.

Private originals, page snapshots, reviews, candidate bundles and backups belong
in the configured local data directory, never the public repository.

## Recover source pages

Install `pdfplumber` and `pymupdf` in a local Python environment. Supply the actual
data directory and original PDF directory:

```powershell
python scripts/recover-source-pages.py --data-dir "D:\Haneul-Data" --original-dir "D:\Haneul-Originals"
```

The command enumerates every declared page, checks original hashes/page counts,
and stages `recovered-source/<importJobId>/<page>.json`. It uses a separate PDF
renderer to recover glyphs missing from older browser previews. Add `--apply`
to restore source snapshots, retaining their previous bytes in `review/`.
Individual snapshot failures remain in the report; later pages still run.

Scanned pages need OCR. An optional local Tesseract worker requires no AI API key:

```powershell
npm install --prefix .haneul/ocr-tool --no-audit --no-fund tesseract.js
node scripts/ocr-source-pages.mjs --data-dir "D:\Haneul-Data" --module .haneul/ocr-tool/node_modules/tesseract.js --workers 4
```

Every successful page is checkpointed separately; errors remain retryable and
do not discard later successes. Re-run page recovery with `--apply` afterward.
OCR text and confidence remain unreviewed and cannot create verified flashcards.

## Reconstruct every lesson

```powershell
python scripts/recover-curriculum.py --data-dir "D:\Haneul-Data" --original-dir "D:\Haneul-Originals"
```

All existing lesson ranges are processed, with no lesson/question/word caps.
An explicit range is required; overlaps and out-of-document ranges fail instead
of silently omitting lessons. The command stages full candidates and a report
under a timestamped `review/source-recovery-*` directory.

The layout reader pairs bilingual table cells, handles separate target/meaning
rows, retains wrapped meanings, and reconstructs grammar blocks and examples.
Grammar continuing before the next heading on a later page is attached to its
preceding pattern. Original numbered tasks and appendix columns are retained;
ambiguous appendix assignments remain explicit, without invented answers.
Unresolved source cells and OCR pages stay in the per-lesson review backlog.

Inspect candidates and source images. Add `--apply` to repeat reconstruction and
update the local library with full backups. Stable matching vocabulary IDs and
existing questions are retained. Grammar corrected from original pages may have
new identities; the previous course is archived, not erased. Do not change
the lesson ranges without comparing their original chapter boundaries.

## Apply visually reviewed units

For scan pages, author structured units only after comparing actual images.
The review JSON contains `fileName`, `originalSha256`, a descriptive `method`,
and a `lessons` map of lesson IDs to grammar arrays. Each grammar entry has
`pattern`, `meaning`, `explanation`, `examples`, and physical `pages`.
An optional `vocabulary` map contains `{ko,vi,pages,meaningOrigin}` entries;
`meaningOrigin` distinguishes source meanings from supplemental translations.
Keep private review JSON outside Git.

```powershell
node scripts/apply-reviewed-source-units.mjs --data-dir "D:\Haneul-Data" --review "D:\Haneul-Data\review\reviewed-units.json"
```

The original PDF hash must match. Inspect the dry-run result, then add `--apply`.
All submitted lessons/items are validated before writes; duplicate patterns,
missing lessons, invalid values, and out-of-range pages fail. Existing questions
and unrelated content remain. Completion stays `partial`: reviewing grammar or
vocabulary alone does not certify all reading/listening/exercise/visual units.

## Verify and continue

```powershell
python -m unittest discover -s scripts -p 'test_recover*.py'
node --test scripts/apply-reviewed-source-units.test.mjs
$env:HANEUL_REGRESSION_LIBRARY="D:/Haneul-Data/courses"
pnpm test
pnpm local:check
```

Inspect several early/middle/final lessons in the real browser. Reconcile every
remaining source unit, answer key, image-dependent task and appendix mapping
before claiming complete source/practice/validation coverage. Raw transcripts,
preserved images and OCR scores are separate evidence, not finished authorship.

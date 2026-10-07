# ChatGPT-assisted textbook import

Haneul uses one Course Bundle contract for both the primary automated compiler
flow and the manual recovery flow.

## Primary flow

The normal workflow is now:

```text
Admin selects PDF(s) in /import
  -> browser extracts text/page previews/fingerprints
  -> Haneul creates and queues an import job
  -> MCP Events emits import_job.queued
  -> ChatGPT/Haneul Learning Bridge prepares the job
  -> source pages are read
  -> work checkpoints are saved
  -> each verified lesson is persisted as a lesson draft
  -> final QA
  -> finalize_course_bundle
  -> Haneul marks the job ready
  -> course is consumed into the Course Library
```

The compiler can resume from checkpoints after an interruption. Completed
lesson drafts are not recompiled unnecessarily.

When PostgreSQL authentication is enabled, the browser import/ingestion HTTP
surface is admin-only. The `/mcp` endpoint keeps its independent MCP token
authentication so the ChatGPT connector does not depend on a learner/admin
browser session.

## Source of truth

The uploaded textbook is the curriculum source of truth.

- preserve source lesson order;
- cover source vocabulary, grammar, dialogue, pronunciation, culture, notes
  and exercises when present;
- generated practice may only recombine knowledge grounded in the same lesson;
- unreadable content is recorded as uncertainty rather than invented;
- every direct knowledge item should retain a source reference;
- derived practice uses `Derived from ...` references.

Example direct reference:

```text
textbook.pdf · p.42
```

Example derived reference:

```text
Derived from textbook.pdf · pp.42-43
```

## Bundle contract

The canonical output remains **Haneul Course Bundle v1**.

```json
{
  "format": "haneul-course-bundle",
  "version": 1,
  "generatedAt": "2026-10-07T00:00:00.000Z",
  "sourceFiles": ["textbook.pdf", "workbook.pdf"],
  "sourceManifest": [
    {
      "name": "textbook.pdf",
      "size": 12345678,
      "lastModified": 1791190000000,
      "pageCount": 220,
      "sha256": "..."
    }
  ],
  "course": {
    "title": "Exact textbook title",
    "level": "초급 1",
    "edition": "optional",
    "lessons": [],
    "questions": []
  }
}
```

The exact runtime lesson/question schema is exposed by the MCP compilation
contract and must match the validator used by `finalize_course_bundle`.

Haneul verifies source fingerprints before accepting a bundle, so content from
another file/edition is not silently imported.

## Media behavior

Large source-page images do not need to be embedded inside the final Course
Bundle. Haneul preserves or reconstructs lesson media from the imported source
snapshots, including:

- extractable raster illustrations;
- full-page preview fallback;
- textbook cover;
- linked video/audio/document URLs;
- source page references.

## Manual recovery flow

The manual handoff remains available only as a fallback/debugging path when the
MCP automation is unavailable.

1. Open `/import`.
2. Select the same source PDF(s).
3. Create the Haneul handoff JSON.
4. Give the PDFs plus handoff to ChatGPT.
5. Compile a Haneul Course Bundle v1 with the same source-grounding rules.
6. Import the returned bundle through the advanced/manual fallback UI.

Manual recovery must not use a different curriculum contract from the automated
flow.

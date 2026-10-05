# ChatGPT-assisted textbook import

This workflow exists for local/personal use when `OPENAI_API_KEY` is not configured.

## Goal

Keep one runtime curriculum contract whether content is generated:

- automatically by the OpenAI API later, or
- manually in a ChatGPT conversation now.

The browser remains responsible for local PDF extraction and media preservation. ChatGPT is responsible for compiling structured lesson content into a portable course bundle.

## Workflow

1. Open `/import`.
2. Select the textbook PDF first and optional workbook/additional PDFs after it.
3. Run local PDF analysis.
   - Text-layer PDFs: text and lesson markers are read locally.
   - Visual pages: page previews and extractable raster images are preserved locally.
   - Scanned PDFs without an API key: OCR is skipped, but page images are still preserved.
4. Upload the same PDFs to ChatGPT.
5. Ask ChatGPT to compile them into a **Haneul Course Bundle v1**.
6. Back in `/import`, select the returned `.json` file under **ChatGPT Assisted**.
7. Haneul validates the bundle, merges the compiled lessons with locally extracted textbook media, resets progress for the new book, and opens the imported curriculum.

## Bundle contract

```json
{
  "format": "haneul-course-bundle",
  "version": 1,
  "generatedAt": "2026-10-05T10:00:00.000Z",
  "sourceFiles": ["textbook.pdf", "workbook.pdf"],
  "course": {
    "title": "Exact textbook title",
    "level": "초급 1",
    "edition": "optional",
    "lessons": [],
    "questions": []
  }
}
```

Each lesson must use the existing `LessonContent` contract in `src/data/content.ts`.
Each question must use the existing `StudyQuestion` contract.

## Source grounding rules

Every extracted item should retain `sourceRef` whenever possible:

```
textbook.pdf · p.42
```

For a derived exercise:

```
Derived from textbook.pdf · p.42–43
```

The bundle should not invent curriculum outside the source material. Derived practice may recombine vocabulary, grammar, dialogue, and examples already present in the source.

## Media behavior

The bundle does not need to contain large base64 textbook images.

Haneul merges bundle lessons with media extracted locally from the PDFs:

- raster illustrations when extractable,
- full-page visual fallback,
- textbook cover,
- linked video/audio/document URLs,
- source page references.

Lesson media is matched primarily by local lesson mapping. If local mapping is unavailable (for example a scanned PDF without OCR), Haneul falls back to page numbers found in lesson `sourceRef` values.

## Future automatic mode

When `OPENAI_API_KEY` is configured, the same Import Studio can generate the same runtime course automatically. The learning UI and persistence layer do not change.

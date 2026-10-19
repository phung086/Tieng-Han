# Haneul

Existing Korean learning platform for Vietnamese learners. Next.js App Router,
React, TypeScript, PostgreSQL authentication and learner progress; textbook
content remains in the existing filesystem course store.

The worksheet workspace serves learners who upload PDF or photographed exercises,
review the recognized questions, obtain suggested answers/translations, and export
a ruled notebook in a handwriting style. The owner supplied references showing
blue-violet ballpoint ink, joined Vietnamese cursive and separate Korean blocks.
Exports contain question/answer pairs without textbook banners or logos. Generated
pages are described as a scan-style rendering, not an actual photographed notebook.

Expand the existing Haneul interface; preserve its purple palette, navigation,
authentication, textbooks and learning flow. The compiler/MCP pipeline is protected.
Worksheet processing is separate and must not create course bundles or progress.

Automatic OCR/translation can use a separately authorized ChatGPT Work / Cloud
MCP Events subscription without an API key. Uploads then trigger worksheet-only
events, and returned answers immediately produce a downloadable notebook PDF.
An API key remains optional. Manual editing and export work locally. Vietnamese
lettering is thin, tall, irregular pen writing based on the owner's references.
Surface mode: Operate. No database migration for this feature.

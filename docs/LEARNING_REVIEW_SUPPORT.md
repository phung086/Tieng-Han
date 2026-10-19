# Learning, review and source support

This release extends the existing learner experience. It leaves the PDF
importer, MCP tools/events, compilation/checkpoint workflow, Course Bundle
validator and file-backed course consumption unchanged.

## Lesson flow

Vocabulary → Grammar → Listening → Speaking → Reading → Writing → Mastery Check.
Existing thresholds remain: active vocabulary recall 70% (or complete Match
Sprint), other assessed stages 75%. Filtered skill sessions include all matching
questions rather than claiming completion after a subset.

Each of the six stages contributes one seventh of lesson progress. They total
86%; a full final check at 75% completes the seventh step and unlocks the next
lesson. Retrying only mistakes, Quick 5 and item review cannot certify the final
check. Legacy completion retains activity history and XP, while requiring the
final check under this rule.

Speech matching compares recognized text in order; it does not grade pronunciation
or prosody. Without recognition, learners explicitly confirm practice for every
sentence. Writing checks the requested structure and source vocabulary, with
learner confirmation; it does not claim to grade meaning or Korean grammar.
Writing drafts are stored per account, course and lesson in this browser.

## Item review

The review catalog includes existing questions, vocabulary, listening, speaking,
reading questions and writing tasks. Only items attempted in the selected course
enter the learned list. Removed or unrelated IDs are excluded.

Sessions freeze up to ten due items, ordered by due date and then strength. Each
row can also open that exact learned item. Wrong answers return today. A correct
answer schedules 1, 3, 7, 14 or 30 days according to the existing strength rule;
repeating correct answers on the same day cannot inflate strength. After a wrong
answer corrected that day, the next review is at most one day away. Speaking,
writing and flashcard review use explicit self assessment, not automatic grading.

## Source support

“Hỗ trợ từ giáo trình” is available in the lesson and after a checked answer. It
retrieves meanings, grammar explanations, examples and question explanations
already stored in that lesson. Source references are displayed. Unsupported
queries return an honest empty result. No external model or API key is required;
this is source retrieval, not a generative chatbot or an additional compiler.

## Account persistence

PostgreSQL remains authoritative for signed-in progress. A browser cache is
identified by account + course, with guest history separately scoped. Importing
guest history is explicit. Loading gates prevent old account/course state from
flashing or being edited while a new context loads.

Writes are serialized and use an optimistic revision returned by the server.
Concurrent or stale saves return 409. The learner can select the server copy or
explicitly replace it with the browser copy; a local backup is kept when choosing
the server. Failed reads never trigger an empty-state upload. Offline changes
remain cached and retry on reconnection or the sync action. Storage-unavailable
browsers can still use account sync, but browser draft/offline persistence cannot
be guaranteed there.

No database migration is introduced. Progress keeps JSON version 2, with optional
review metadata. The learning-state PUT adds expectedUserId and expectedUpdatedAt;
older request shapes remain accepted for compatibility.

The course cache is also tagged with the account/role audience. An offline cache
from an admin session is not reused by a guest or a different account. Successful
empty published-course responses remain authoritative.

## Validation

Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`.

With the app and PostgreSQL running locally, run:

```powershell
pnpm test:learning-flow http://localhost:3000
```

This integration check creates two temporary learner accounts, checks isolation,
concurrent writes, stale revisions, validation, origin checks and logout, and
removes only those test accounts. It requires two published courses and refuses
remote app/database hosts. Unit tests cover scheduling, completion, day rollover,
guest migration, save ordering, exact review items and source-based support.

Manual browser QA covers desktop/mobile review, lesson source search, empty
results and course switching. Microphone recognition and actual audio quality
still depend on the browser, permissions and installed language voices.

The validated suite contains 80 passing unit tests. Production build completes
with two existing Turbopack filesystem-tracing warnings in the protected
`import-job-store.ts`; that subsystem is intentionally unchanged. No release
claim covers an exhaustive audit of every sentence in the imported textbooks.

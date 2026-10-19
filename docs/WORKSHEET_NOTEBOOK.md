# Vở bài tập

Route `/worksheets`: PDF/JPG/PNG/WebP/TXT → automatic worksheet event → ChatGPT
Work / Cloud solves/translates → automatic result uptake and PDF preparation →
download A4 PDF / current-page PNG. Editing/review remains available, but there
is no mandatory result acceptance or review checkbox. JSON import/manual work
and an optional API provider remain available.
JSON export/import allows saving work. This feature never imports a textbook or
updates learner progress. No database migration. Existing `/mcp`, compiler,
contracts, checkpoints and course store are unchanged.

## ChatGPT without an API key

New, separate Streamable HTTP endpoint `/worksheet-mcp`, two tools:
`read_worksheet(jobId, accessKey, page?)` and
`submit_worksheet(jobId, accessKey, sourceDigest, items)`.

Configure a separate custom MCP plugin in ChatGPT, using the existing HTTPS tunnel
base URL with `/worksheet-mcp`, or a Secure MCP Tunnel to the local endpoint.
Choose No authentication at connection level. Tools still require a random
256-bit capability scoped to ONE job; they cannot list jobs or access accounts.
The separate endpoint advertises MCP 2.0 (`2026-07-28`) and implements
`events/list`, `events/subscribe`, `events/unsubscribe` for `worksheet_job.queued`.
A one-time setup prompt authorizes a private account channel; later uploads emit
only the job capability/digest/expiry to its verified callback. See
[WORKSHEET_AUTOMATION.md](WORKSHEET_AUTOMATION.md) for configuration and limits.
Existing textbook event subscriptions are not reused or modified.

Official connection documentation:
https://developers.openai.com/plugins/deploy/connect-chatgpt
https://developers.openai.com/plugins/build/mcp-events

Job creation/read/delete uses the learner's existing authenticated account. Local
development without database allows a local owner; production requires login.
`.haneul/worksheet-jobs` holds source/result files (optional HANEUL_WORKSHEET_DIR).
Jobs expire after 24 hours; expired files are removed on access / next job creation.
The user can delete a job immediately to remove its source/result and revoke access.
Storage is separate from curriculum files; disk backups should follow the same
privacy rules. Limit: 12 retained jobs/account. Capabilities are hashed on disk.
Source digests, valid pages, IDs, answer count/order for textual sources, and
idempotent submission prevent stale/mismatched writes. A ChatGPT-generated answer
is still a suggestion: review exact names, unclear image content and politeness.

If the custom plugin is not connected yet, attach source files directly in ChatGPT
and request the documented JSON format; import its JSON into the worksheet page.
The interface includes this fallback and the expected schema.

## Optional API

Uses the existing content-ai provider with server-side OPENAI_API_KEY and existing
model configuration. Never place keys in NEXT_PUBLIC variables. Source files are
sent to OpenAI only on the user's explicit API action. Missing key returns 503;
manual editing/export and the separate MCP workflow remain available.
Eight model requests / 10 min / account, one concurrent request/account, four
globally per server process. This is a local/deployment process limit, not a shared
distributed rate limiter. Source extraction and solving are separate steps.

## Rendering

Self-hosted SIL OFL Bad Script and Hi Melody cover Vietnamese/Hangul.
200 dpi canvas (1654×2339), 64 px ruled spacing, blue-violet/black ink, deterministic
letter-level Vietnamese height/slant/baseline variation and word-level pressure.
The new face uses thinner monoline loops than the old Dancing Script. NFC
preserves Vietnamese accents. Optional procedural paper grain and
scan lighting. No title, logo, warning or metadata is painted on pages. PDF embeds
the same rendered pages, avoiding font substitution. It is an image PDF (no text
search layer), described in UI and PDF metadata as digitally rendered. It does
not reproduce the reference author's unique handwriting exactly.

Verify with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; inspect desktop
and mobile, export a mixed Vietnamese/Hangul sample and verify page pagination.

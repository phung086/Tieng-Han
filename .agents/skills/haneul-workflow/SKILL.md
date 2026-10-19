---
name: haneul-workflow
description: Change or diagnose Haneul upload, worksheet and learning workflows while preserving compiler contracts and per-account/course progress. Use for Haneul workflow work, not unrelated applications.
---

Read PRODUCT.md, DESIGN.md and the relevant source before changing behavior. Read the installed Next.js guide under node_modules/next/dist/docs for APIs you use.

Treat /mcp and the compiler as an external contract. Do not edit src/app/mcp/route.ts, src/lib/import-job-store.ts, src/lib/mcp-events.ts, compilation contracts, grounding checks or bundle formats unless the user explicitly requests compiler implementation changes. Import monitoring can read existing status, drafts and checkpoints; passive observation must never consume or alter the original MCP request.

Worksheet jobs use /worksheet-mcp and separate stores. Preserve per-job capability checks, owner checks, sourceDigest validation, source page order and warnings. Never expose channelKey, accessKey, bearer tokens, callback URLs or signing secrets in logs, tests or screenshots. Do not manually submit answers to claim an automatic provider run passed.

Use src/lib/workflow-state.ts and WorkflowRail for progress based on evidence. Distinguish webhook receipt, source reads, returned results and file readiness. Inactivity is unknown provider state, not proof of failure. Bounds on browser requests must not automatically retry writes. Preserve source/checkpoints on errors and avoid concurrent workers when resuming.

Learning progression stays scoped by account and course. Preserve completion thresholds and scheduled review rules. Use the shared auto-advance control for correct answers, leave wrong answers for review, respect IME input and cancel obsolete timers. Verify single score recording under rapid clicks.

Run relevant Vitest checks, lint, typecheck and build. The owner's live checkout may be D:/Tieng-Han/Tieng-Han: compare files before applying changes, preserve its own environment, dependencies and live .next directory, and build in the worktree. Report what was verified and any provider limitation separately.

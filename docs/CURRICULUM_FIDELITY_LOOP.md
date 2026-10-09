# Curriculum-fidelity development loop

## Completion contract (not a fixed quiz cap)

For **every imported textbook lesson**, independently enumerate all vocabulary entries, sample sentences, dialogue lines, grammar examples, reading questions, listening prompts and exercise items, including subparts. Record page and section provenance. The practice bank must offer a coverage path for **every** enumerated source item, preserving the textbook's exercise mechanics and order where appropriate. Optional adaptive repetition may add more exercises but cannot silently replace or reduce source coverage. A 5-question warmup is allowed only as a separately labeled convenience mode.

Do not confuse a question total with item-level coverage: 50 generic questions do not certify coverage for 50 source words. Store stable source-item IDs, source page, exercise kind, question variant, and mapping from source item to one or more practice items. Report gaps and duplicates explicitly. An independent, page-by-page source inventory is required before marking any lesson 100% complete.

## Priority and compatibility

1. Full vocabulary / grammar / reading / exercise fidelity with accessible full-length practice sessions.
2. Correct feedback, persistence, continuation, mastery, and item-level review.
3. UI polish, navigation and learning flow.

Never modify import-job lifecycle, MCP events, extraction, compilation schema, published Course Bundle shape, source fingerprints or database migrations as part of an unrelated practice change. Introduce additive versioned contracts and regression tests if future work absolutely requires such changes.

## Shared repository and conflict prevention

- Every coding agent creates its own branch from the current main; never commit directly to main or to another agent's branch.
- Fetch newest main and inspect open PR changed paths before editing. Assign non-overlapping ownership; isolate modules and submit small PRs.
- Require lint, typecheck, Vitest, build, Playwright, import regression, and fidelity coverage gate prior to merge.
- Disable unattended force pushes, auto-merges, and branch deletion. A reviewer resolves overlapping PRs and re-runs CI.
- Import-related tests must verify that existing import endpoints and published content still work unchanged.

## 45-minute recurring audit

The scheduled workflow runs every 15 minutes but selects one of every three UTC quarter-hour slots, giving a **nominal** 45-minute cadence. GitHub-hosted scheduled events can be delayed or dropped; it is not a guaranteed timer. The audit is **read-only**, does not call an AI worker, and cannot continuously fix issues or certify absent artifacts. A workflow_dispatch provides a manual run.

The script audits local `.haneul/courses/*.json` and optionally `curriculum/source-inventory.json`. On a hosted runner, the local course library is absent unless an authorized artifact-provisioning stage is added. Missing source inventory returns `unverified`, never a false fidelity success. Set `HANEUL_REQUIRE_VERIFIED=1` for strict certification once both inputs are provisioned. Override `HANEUL_COURSE_LIBRARY`, `HANEUL_SOURCE_INVENTORY`, and `HANEUL_AUDIT_REPORT` to provide controlled fixtures. The recurring audit sets `HANEUL_AUDIT_NONBLOCKING=1`, whereas release checks omit it.

Example independently validated inventory:

```json
{
  "courses": {
    "course-actual-import-id": {
      "lessons": {
        "1": {
          "vocabulary": 45,
          "grammar": 3,
          "dialogueLines": 12,
          "readingQuestions": 8,
          "reviewQuestions": 68
        }
      }
    }
  }
}
```

Numbers above are **illustrative**, not extracted counts for any real textbook. Count parity is necessary but insufficient; item-level traceability and exercise pattern fidelity require separate source-aligned fixtures.

## Agent iteration (external runner required)

A separately deployed agent with GitHub write credentials and compute budget can use audit gaps as its work queue: read the actual textbook/source inventory -> patch only the learning/practice domain -> test -> publish isolated PR -> wait for review and successful CI -> reevaluate. GitHub Actions by itself cannot supply an autonomous coding model or unlimited compute. Do not generate guessed textbook facts if source data is unavailable. Retain work queues until verified rather than declaring completion or attempting infinite self-retries.

## Never-abort iteration policy

**Blocked does not mean stop the development schedule; blocked does not mean pass the release gate.**

- **Broken lesson/course JSON:** record the error code, course and affected item; continue with remaining files and lesson IDs. Preserve valid output and source files unchanged.
- **Missing imported PDFs, inventory, or source evidence:** report `unverified` and a specific sourcing task. Never invent words or questions; other independent tasks (test coverage, practice logic, UI) remain eligible.
- **Missing AI credentials/provider, exhausted quota, unavailable network:** record the dependency and prepare deterministic fixtures, regression tests, or other ready work; retry the blocked provider in a later iteration without repeated immediate requests.
- **Git conflict or another agent's branch touching the same module:** defer the conflicting edit, fetch current main and open PRs, and work on a different scoped issue. Never force-push over a collaborator.
- **Failed test, build or import regression:** report diagnostics, keep the PR in Draft, quarantine the change; continue other branches/cycles. Never bypass required CI to ship a broken build.
- **Audit runner exception or GitHub API failure:** the GitHub Actions steps use `continue-on-error` / `always()` to attempt publishing reports and a rolling GitHub Issue. A future scheduled run can execute even when this run fails.
- **Missing report file:** explicitly flag a runner fault; do not substitute a successful/green data-fidelity status.

Each non-skipped scheduled cycle uploads its JSON report as a uniquely named, 30-day-retained GitHub Actions artifact and updates **one** reusable backlog Issue (only when the issue contents change). The report records severity, scope, error code and actionable next step. Repeat cycles never erase the underlying data deficiency merely to pass an audit. GitHub retention means artifacts are not a permanent audit database; provision durable external storage if long-term history becomes necessary.

`node --test scripts/audit-curriculum-fidelity.test.mjs` exercises missing inventory, broken JSON isolation, continuing to a second file, count mismatch reporting and strict-vs-nonblocking behavior. Regression tests are nonblocking **for the recurring audit**, not evidence that the PR is safe to merge. Do not relax normal PR CI.

**Limitations:** A GitHub scheduled workflow provides repeated checks but cannot do endless independent AI coding without an external coding agent and authorized runner. GitHub may delay/drop cron triggers; GitHub Actions is not an exact guaranteed 45-minute scheduler. Schedules run from the default branch, so this interval begins only after the workflow is merged. The rolling GitHub Issue is an actionable handoff queue, not an autonomous model.

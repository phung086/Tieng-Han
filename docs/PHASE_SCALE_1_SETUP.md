# Phase Scale 1 — PostgreSQL, Authentication and Roles

Phase Scale 1 adds a server-side identity and persistence layer **around** the
existing Haneul learner/compiler baseline. It does not replace MCP Events,
course compilation, Course Bundle validation, or the six-skill learning flow.

## What this phase adds

- Email/password registration and login.
- Password hashing with Node.js scrypt.
- Opaque server-side sessions stored in PostgreSQL.
- HTTP-only, SameSite=Lax session cookie.
- Roles: `learner` and `admin`.
- Admin-only access to `/import` once DATABASE_URL is enabled.
- Admin dashboard at `/admin`.
- Course publish/draft/archive state.
- User/course enrollment tracking.
- Per-user/per-course learning-state sync.
- Profile display-name management.
- Persisted preset avatar and account join date.
- Password changes with optional revocation of other sessions.
- Active-session/device management.
- Admin account enable/disable controls with session revocation.
- Browser localStorage remains a fallback and migration source.
- Audit events for registration, login/logout, account security and admin mutations.

## 1. Provision PostgreSQL

Use any PostgreSQL 14+ database that is reachable by the Next.js server.

Set this in `.env.local`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

Do not commit `.env.local`.

### Existing PostgreSQL 18 cluster on Windows

If `C:\Program Files\PostgreSQL\18\data` already exists, do not run
`initdb` again. Check the existing cluster first:

```powershell
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$pgData = 'C:\Program Files\PostgreSQL\18\data'
& "$pgBin\pg_ctl.exe" status -D $pgData
```

If it is stopped, start it and check readiness:

```powershell
& "$pgBin\pg_ctl.exe" start -D $pgData -l "$env:LOCALAPPDATA\haneul-postgres-start.log"
& "$pgBin\pg_isready.exe" -h localhost -p 5432
```

Keep the startup log outside the data directory to avoid a Windows file-sharing
conflict during crash recovery. If startup fails, inspect the startup log and
the PostgreSQL logs identified by `data\current_logfiles`.
Without a Windows service, repeat the start command after restarting Windows.

Use a dedicated login such as `haneul_app` that owns the `haneul` database.
Configure its password only in the local environment file. Each Git worktree
has its own `.env.local`; configure the checkout from which you run Next.js
and migrations. Restart Next.js after changing the environment file.

## 2. Install dependencies

```powershell
pnpm install
```

## 3. Create/update schema

```powershell
pnpm db:migrate
```

The migration runner is idempotent and records applied migrations in
`haneul_schema_migrations`.

## 4. Create the first account

Start Haneul:

```powershell
pnpm dev
```

Open:

```text
http://localhost:3000/register
```

Register your normal account. New public registrations are always created as
`learner` for safety.

## 5. Promote the owner account to admin

Stop or keep the dev server running in another terminal, then execute:

```powershell
pnpm db:promote-admin your-email@example.com
```

Log out and log in again. The sidebar will expose **Quản trị** and
`/import` becomes admin-only.

## 6. How learner progress migration works

When a signed-in learner opens a course:

1. Haneul checks PostgreSQL for `user_id + course_id`.
2. If a server state exists, it becomes authoritative.
3. Browser caches are scoped by both account and course. Guest study is never
   silently copied into a signed-in account.
4. If the account has no server progress and guest progress exists for this
   course, the learner can explicitly import it using the sync bar.
5. Subsequent progress changes are debounced and saved in order. A conflicting
   server revision requires the learner to choose the server or browser copy.

Existing course-scoped local progress is migrated into the guest cache. The
explicit import preserves it without attributing another person's shared-browser
study to a newly signed-in account. A failed server read never uploads an empty
fallback over existing account progress.

## 7. Course publication

The existing file-backed Course Library remains the source of compiled course
content in Phase Scale 1.

PostgreSQL stores a catalog/visibility layer:

- `published`: visible to learners.
- `draft`: admin only.
- `archived`: admin only.

Newly discovered courses are registered as `draft`, including the first catalog sync. Existing persisted publication decisions remain unchanged. Publishing requires a complete submitted-source inventory reconciliation; see `docs/SOURCE_INVENTORY.md`.

## 8. Role boundaries

### Learner

- Browse published courses.
- Learn using the existing six-skill flow.
- Save progress/mastery/XP per account and course.
- Enroll automatically when progress is saved or a course is selected.

### Admin

- All learner capabilities.
- Open `/admin`.
- Open `/import`.
- Use the protected import/ingest APIs behind the same admin boundary.
- Monitor queued/processing/ready/failed jobs from `/admin`.
- Upload/import source PDFs using the unchanged MCP pipeline.
- Publish, draft or archive courses.
- Promote/demote users while protecting the final active admin.
- Enable/disable learner accounts.
- Disabling an account revokes all of its server sessions.
- Review recent audit activity.

### Account owner

Signed-in users can open `/settings` to:

- update their display name and avatar preset;
- view their account join date on the profile page;
- change their password;
- view active sessions/devices;
- revoke another session;
- sign out all other devices.

## 9. Protected systems

Phase Scale 1 must not silently change:

- MCP Events subscription flow.
- `prepare_import_job`.
- checkpoint / lesson-draft / finalize workflow.
- sourceRef grounding rules.
- Course Bundle runtime contract.
- file-backed compiled course payloads.

A later phase can move compiled course payloads into object storage/database,
but that is intentionally not part of this migration.


## 10. Import API boundary

When `DATABASE_URL` is configured, the browser-side import and AI-ingestion
HTTP routes require an authenticated admin. Mutating routes also require a
same-origin request.

This applies to the UI-facing `/api/import-jobs/*`, `/api/ingest/*` and
MCP automation status endpoints. It does **not** replace the separate MCP
token/authentication used by `/mcp`, so ChatGPT/Haneul Learning Bridge keeps
its existing compiler connection.

When PostgreSQL is not configured, these browser APIs preserve the existing
local-first development behavior.

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
3. If no server state exists, the existing course-scoped browser state is
   loaded.
4. That browser state is then synced to PostgreSQL after hydration.
5. Subsequent progress changes are debounced and synced automatically.

This keeps current local progress instead of resetting learners on the first
login.

## 7. Course publication

The existing file-backed Course Library remains the source of compiled course
content in Phase Scale 1.

PostgreSQL stores a catalog/visibility layer:

- `published`: visible to learners.
- `draft`: admin only.
- `archived`: admin only.

Existing courses are registered as `published` on the first catalog sync so
Sơ cấp 1 and Sơ cấp 2 remain available after enabling the database. After that
bootstrap, newly discovered/imported courses enter the catalog as `draft` and
an admin publishes them explicitly.

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
- Upload/import source PDFs using the unchanged MCP pipeline.
- Publish, draft or archive courses.
- Promote/demote users while protecting the final active admin.
- Enable/disable learner accounts.
- Disabling an account revokes all of its server sessions.
- Review recent audit activity.

### Account owner

Signed-in users can open `/settings` to:

- update their display name;
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

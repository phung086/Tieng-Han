# Haneul Module Status

This file defines the current product-complete baseline for the modules that
already exist in the repository. New scale/features should extend these
boundaries instead of rewriting them.

## 1. Course Library

Status: complete for current scale.

Includes:

- multiple imported courses preserved at the same time;
- active-course selection persisted in the browser;
- PostgreSQL publication visibility when the database is enabled;
- long-title-safe cards;
- search by title/source file;
- level filtering;
- course-scoped learning progress.

## 2. Learner flow

Status: complete for the current six-skill baseline.

Includes:

- Home next-action dashboard;
- staged lesson map;
- Vocabulary;
- Grammar;
- Listening;
- Speaking;
- Reading;
- Writing;
- Mastery Check;
- Conversation and Pronunciation enrichment;
- immediate answer feedback;
- correct-answer auto advance where appropriate;
- source-grounded explanations;
- responsive desktop/mobile behavior.

## 3. Practice and review

Status: complete for the current local/server state model.

Includes:

- Guided Session;
- Quick 5;
- Mastery Check;
- focused skill modes;
- mistake retention;
- item mastery strength;
- due-date review queue;
- course-scoped XP/streak/accuracy.

## 4. Account and authentication

Status: complete for Phase Scale 1.

Includes:

- registration/login/logout;
- scrypt password hashing;
- opaque PostgreSQL-backed sessions;
- profile display-name update;
- password change;
- other-session revocation;
- per-device session list;
- active/disabled account status;
- learner/admin roles.

Email verification, social login and password-reset email are deliberately
outside Phase Scale 1 because they require an outbound email/identity provider.

## 5. Learner persistence

Status: complete for Phase Scale 1.

Includes:

- browser local fallback;
- user + course enrollment;
- user + course learning-state sync;
- migration from local course-scoped progress;
- cross-device server state after login.

## 6. Admin

Status: complete for Phase Scale 1.

Includes:

- admin-only import route;
- course draft/published/archived controls;
- learner/admin role controls;
- active/disabled account controls;
- protection for the final active admin;
- session revocation when an account is disabled;
- audit-event feed;
- overview metrics.

## 7. Import and ChatGPT compiler

Status: protected and operational baseline.

Includes:

- PDF ingestion;
- import jobs;
- MCP Events bridge;
- source page reading;
- checkpoints;
- lesson drafts;
- finalized Course Bundle;
- source fingerprint validation;
- sourceRef grounding;
- resume after interruption.

This module is protected from unrelated learner/admin refactors.

## 8. Quality gates

Status: enabled.

Every pull request runs:

- ESLint;
- TypeScript typecheck;
- Vitest;
- Next.js production build;
- Playwright Chromium smoke tests on desktop and Pixel 7 viewports.

The browser suite covers multi-course layout, course switching, answer
auto-advance, Reading progressive disclosure, account settings and horizontal
overflow checks across learner/account routes.

## Next scale boundary

Features not listed above are new product scope, not unfinished work in the
current modules. Examples:

- email verification/password reset delivery;
- organization/classroom/teacher model;
- subscriptions/payments;
- notifications;
- social/competitive modes;
- native mobile apps;
- object-storage migration;
- background worker infrastructure;
- advanced BI/admin analytics.

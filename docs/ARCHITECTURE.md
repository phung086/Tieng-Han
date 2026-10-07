# Architecture — Haneul modular monolith

## Current decision

Haneul remains a **single Next.js application** for the current scale, but the
runtime is now split into explicit modules with stable boundaries:

- learner experience;
- course library;
- local/browser persistence;
- PostgreSQL identity and progress sync;
- admin/catalog controls;
- PDF import and MCP/ChatGPT compilation.

This keeps local development simple while avoiding coupling the learning UI to
the compiler.

## Runtime architecture

```text
Browser
  |
Next.js App Router
  |
  +-- Learner UI
  |     +-- Course Library
  |     +-- Lesson flow / six skills
  |     +-- Practice / Review / Stats
  |     +-- Profile / Settings
  |
  +-- Account API
  |     +-- registration/login/logout
  |     +-- profile/password/session management
  |     +-- per-user course enrollment
  |     +-- per-user/per-course learning state
  |
  +-- Admin API
  |     +-- course publication
  |     +-- user roles/status
  |     +-- audit trail
  |
  +-- PostgreSQL
  |     +-- users/sessions
  |     +-- course catalog visibility
  |     +-- enrollments
  |     +-- learning states
  |     +-- audit events
  |
  +-- File-backed compiled course library
  |
  +-- Import/MCP boundary
        +-- PDF page snapshots
        +-- import jobs
        +-- MCP Events
        +-- ChatGPT compilation checkpoints
        +-- finalized Course Bundle
```

## Persistence split

Compiled course payloads remain file-backed in Phase Scale 1. PostgreSQL stores
identity, permissions, visibility and learner state around those course
payloads.

This separation is intentional:

```text
Course content source of truth
  -> compiled Course Bundle / .haneul course library

Account + permission + progress source of truth
  -> PostgreSQL
```

The browser still keeps course-scoped local state as an offline/fallback
migration source.

## Protected compiler boundary

Learner/admin development must not silently alter:

- MCP Events subscription behavior;
- import-job lifecycle;
- `prepare_import_job`;
- checkpoint / lesson-draft / finalize workflow;
- sourceRef grounding;
- Course Bundle runtime compatibility.

The compiler can evolve only through an explicit compiler-contract change.

## Domain rules

1. Giáo trình là source of truth.
2. Mỗi knowledge item phải truy vết được về sourceRef.
3. Derived practice chỉ dùng kiến thức đã mở khóa trong cùng lesson scope.
4. Progress được lưu theo user + course + lesson/skill/item.
5. Course publication is an admin concern, not a compiler concern.
6. Gamification supports learning decisions; it must not obscure them.
7. Learners only see published courses when PostgreSQL is enabled.
8. Enrollment and learning-state APIs enforce the same course visibility policy.
9. Learning-state counters reject impossible values such as correct > total.
10. Disabling an account revokes its server sessions.

## Scaling path

The current modular monolith can be deployed as one Next.js service plus
PostgreSQL and persistent storage for `.haneul` course/import data.

A later scale phase may move compiled course payloads/media to object storage
or split workers/services, but the browser APIs and MCP contract should remain
stable so that infrastructure changes do not rewrite the learning product.

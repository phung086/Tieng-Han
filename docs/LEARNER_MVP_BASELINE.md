# Haneul Learner MVP Baseline

This document freezes the learner-facing baseline before authentication,
multi-user persistence and admin features are introduced.

## Core learner workflow

- Import one or more textbook PDFs.
- Haneul queues the source and ChatGPT compiles it through MCP Events.
- Import survives refresh and resumes queued/processing/ready monitoring.
- Every consumed book is preserved in the multi-level Course Library.
- Learning progress, XP, mastery and lesson completion are scoped per course.
- The learner can switch between Sơ cấp 1, Sơ cấp 2 and future courses without
  overwriting previous course data.

## Learning experience

Each lesson has two progression-critical core stages:

1. Vocabulary
2. Grammar

Listening, Speaking, Reading and Writing remain available as optional practice.
Mastery Check is also optional. Completing optional skills adds practice evidence
and XP, but never blocks the next lesson.

Core progression is evidence-based:

- Vocabulary Active Recall: >= 70% remembered, or complete Match Sprint.
- Grammar: >= 75% on filtered grammar practice.

The next lesson unlocks once the available Vocabulary + Grammar core is
complete. Listening, Speaking, Reading and Writing can be skipped when the
learner is not in a suitable situation and resumed later.

Lessons expose the next recommended activity directly so learners do not have
to navigate back to a dashboard after every stage.

## Practice and review

Practice Hub includes:

- Guided Session
- Quick 5
- Mastery Check
- Six focused skill modes

Question sessions provide immediate feedback, combo/focus feedback, mistake
retry and source-grounded explanations.

Memory Garden uses the local mastery schedule to prioritize due and weak
material rather than forcing full-lesson repetition.

## Source-grounded enrichment

When the textbook provides the data, lessons also expose optional:

- Conversation Lab from textbook dialogues.
- Pronunciation Lab from textbook pronunciation notes.
- Culture, media and extra textbook sections.

These enrichment labs do not alter the six-skill completion model.

## Learner surfaces

The learner baseline includes:

- Home / daily learning dashboard
- Course Library and staged learning world
- Lesson mission path
- Vocabulary, Grammar, Listening, Speaking, Reading and Writing labs
- Practice Hub
- Memory Garden review
- Progress / performance
- Local learner profile
- Conversation and pronunciation immersion labs

## Protected systems

The learner UI layer must not silently change:

- MCP Events subscription flow
- import-job lifecycle
- compiler contract
- source grounding rules
- lesson draft/checkpoint/finalize workflow
- Course Bundle runtime compatibility

## Scaling phase

The next architecture phase may add:

- registration/login/logout
- server-side sessions
- learner/admin roles
- PostgreSQL persistence
- user/course enrollment
- cross-device progress sync
- admin course publishing
- migration from local progress to user-scoped server records

Those changes should wrap this baseline instead of rewriting the compiler or
learning content model.

# AGENTS.md — handoff

## Purpose

Two kinds of artifacts live here: session summaries (`session_<YYYY-MM-DD>.md`), and per-feature plan/feedback pairs (`<feature>_plan.md` / `<feature>_feedback.md`) produced by the FULL/LIGHT-mode agent orchestration flow (see root `CLAUDE.md`'s Handoff Protocol).

## Ownership

Session summaries are generated content, written by the `/sesend` skill at the end of a session and read by `/sesstart` to restore context at the start of the next one — don't hand-author entries outside its format, and don't edit past entries to rewrite history. Plan/feedback files are written by the **planner**/**orchestrator** and **reviewer** respectively during a feature's implementation — they're working documents for that feature's lifecycle, not a permanent log; stale ones from completed, shipped features may be cleaned up.

## Local Contracts

- Filename format `session_<YYYY-MM-DD>.md` is load-bearing for `/sesstart` to find the latest session — don't rename files or change the date format.
- Plan/feedback filenames follow `<feature>_plan.md` / `<feature>_feedback.md`, matching the Handoff Protocol in the root `CLAUDE.md`.

## Verification

(none)

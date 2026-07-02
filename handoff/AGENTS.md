# AGENTS.md — handoff

## Purpose

Session summary log, one file per session (`session_<YYYY-MM-DD>.md`). Written by the `/sesend` skill at the end of a session; read by `/sesstart` to restore context at the start of the next one.

## Ownership

Generated content — don't hand-author entries outside the `/sesend` skill's format, and don't edit past entries to rewrite history.

## Local Contracts

- Filename format `session_<YYYY-MM-DD>.md` is load-bearing for `/sesstart` to find the latest session — don't rename files or change the date format.

## Verification

(none)

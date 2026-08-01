# Review: upstash-install-prompt
**Date:** 2026-08-01
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
- Reviewer had no Bash access and couldn't independently re-run `shellcheck` — resolved by the orchestrator: `shellcheck deploy/install.sh` re-run directly, clean.
- Root `README.md` Tech Stack bullet still read "optional — falls back to in-memory cache when not configured", inconsistent with the corrected Environment Variables table row — resolved: reworded to note `rateLimit()` has no fallback.

## Passed Checks
- [x] New Step 5b in `deploy/install.sh` placed correctly — immediately after the Turnstile step, before port allocation.
- [x] Uses the exact same `require_tty` + `read -r -p ... < /dev/tty` + non-empty validation pattern as the Turnstile step.
- [x] `.env` heredoc includes both `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`, correctly named and positioned.
- [x] Secrets discipline (AD-7) preserved — no echoing outside the prompt and the `.env` write; not included in the final summary or `CREDENTIALS.txt`.
- [x] `deploy/README.md`, `deploy/AGENTS.md`, root `README.md` all updated consistently — no doc claims Upstash is optional for a fresh install.
- [x] No files outside the four declared were touched.

## Summary
Faithful implementation of the plan: the new prompt mirrors the proven Turnstile pattern exactly, `.env` writes both vars correctly, secrets discipline holds, and all four docs are now consistent. Both minor findings were non-blocking and have been closed out directly.

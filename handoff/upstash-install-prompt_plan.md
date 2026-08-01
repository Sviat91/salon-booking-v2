# Plan: prompt for Upstash Redis keys in install.sh

## Goal

`rateLimit()` (`src/lib/cache.ts:63`) has no fallback — without a working
Redis connection it always returns `{ allowed: true }`, i.e. every rate limit
in the app (including the ones added today in
`handoff/turnstile-hardening_plan.md`) is silently disabled. `install.sh`
currently never asks for `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`,
so a freshly deployed instance has zero rate limiting by default. Make it
prompt for these the same way it already prompts for Turnstile keys (Step 5,
`deploy/install.sh:158-167`) — required, not optional, for consistency with
how Turnstile is already handled and because the whole point of today's
hardening pass is for the protection to actually be live in production.

## Changes

### 1. `deploy/install.sh`

Insert a new step immediately after the existing Turnstile step (after line
167, before "Step 6: AD-4 port allocation"), following the exact same
`require_tty` + `read -r -p` + non-empty validation pattern:

```bash
# ---------------------------------------------------------------------------
# Step 5b: Upstash Redis keys (required — src/lib/cache.ts's rateLimit() has
# no fallback; without these, every rate limit in the app, including the ones
# this installer's Turnstile keys protect, is silently disabled). Same
# reasoning as Turnstile: external signup, cannot be automated.
# ---------------------------------------------------------------------------
require_tty "Upstash Redis keys"
read -r -p "Upstash Redis REST URL: " UPSTASH_REDIS_REST_URL < /dev/tty
read -r -p "Upstash Redis REST token: " UPSTASH_REDIS_REST_TOKEN < /dev/tty
if [ -z "$UPSTASH_REDIS_REST_URL" ] || [ -z "$UPSTASH_REDIS_REST_TOKEN" ]; then
  echo "ERROR: both Upstash keys are required — rate limiting has no fallback without them." >&2
  exit 1
fi
```

Add the two vars to the `.env` heredoc (`deploy/install.sh:203-210`), after
the Turnstile lines and before `NEXT_PUBLIC_SITE_URL`:

```
UPSTASH_REDIS_REST_URL="${UPSTASH_REDIS_REST_URL}"
UPSTASH_REDIS_REST_TOKEN="${UPSTASH_REDIS_REST_TOKEN}"
```

No other part of the script changes — secrets handling rules (AD-7 in
`deploy/AGENTS.md`) already apply: these two values must never be echoed,
logged, or appear anywhere except this prompt and the `.env` write.

### 2. `deploy/README.md`

- In the "Before running it, have ready" list, add a new item (as item 2,
  renumbering Turnstile to 3 and admin email to 4):
  > **An Upstash Redis database (free tier is enough)** — sign up at
  > upstash.com, create a database, the installer will prompt for the REST
  > URL and token. Without this, rate limiting is silently disabled
  > (`rateLimit()` has no fallback, unlike the app's cache which degrades to
  > in-memory automatically).
- Update the sentence "Turnstile keys are always prompted for interactively —
  there is no flag for them." to "Turnstile keys and Upstash Redis keys are
  always prompted for interactively — there is no flag for either."
- Update "What it does" bullet about `.env` generation to also mention
  Upstash keys alongside Turnstile keys.

### 3. `deploy/AGENTS.md`

Add one bullet under "Local Contracts" (after AD-9, before the
`.dockerignore` paragraph) documenting this as a binding requirement:

> - Upstash Redis REST URL/token are prompted for interactively, same as
>   Turnstile keys (external signup, cannot be automated) — required, not
>   optional. `rateLimit()` (`src/lib/cache.ts`) has no in-memory fallback
>   unlike the app's cache layer; without these, every rate limit in the app
>   is silently disabled in production.

### 4. Root `README.md`

- In "Production Deployment", update the "Before running it, have ready:"
  sentence to add Upstash alongside the domain/Turnstile/email items.
- In the Environment Variables table, fix the `UPSTASH_REDIS_REST_URL` /
  `TOKEN` row — it currently reads "Falls back to an in-memory cache when
  unset (fine for a single-instance small deployment)", which is only true
  for `cacheGet`/`cacheSet`, not for `rateLimit()` (no fallback — silently
  disabled). Reword to state both behaviors accurately, and note the
  installer now requires it.

## Out of scope

- No change to `src/lib/cache.ts` itself (no fallback for `rateLimit()` is
  existing, intentional behavior — not being changed here, just documented
  accurately and made a hard requirement at install time).
- No change to already-deployed instances — this only affects future
  installs.

## Acceptance criteria

- [x] `install.sh` aborts with a clear error if Upstash keys are empty,
      exactly like it already does for Turnstile.
- [x] `.env` written by the installer contains both
      `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- [x] `shellcheck deploy/install.sh` stays clean.
- [x] `deploy/README.md`, `deploy/AGENTS.md`, root `README.md` all updated
      consistently — no doc left claiming Upstash is optional for a fresh
      install.
- [x] No changes to any file outside `deploy/install.sh`, `deploy/README.md`,
      `deploy/AGENTS.md`, root `README.md`.

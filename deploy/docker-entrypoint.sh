#!/bin/sh
# Runs on every container start (including plain restarts, not just first install).
# `prisma migrate deploy` is idempotent — it only applies migrations that haven't
# run yet against the mounted DB volume — so it's safe to run unconditionally here.
set -e

./node_modules/.bin/prisma migrate deploy

exec "$@"

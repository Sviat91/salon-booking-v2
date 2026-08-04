#!/usr/bin/env bash
#
# One-command installer for Salon Booking on a fresh Ubuntu 22.04/24.04 LTS VPS.
# Supports multiple independent instances (different clients) on the same VPS —
# each install is namespaced by --name. Re-running for an already-installed
# --name aborts cleanly; this script does not support updating an existing
# instance (first install only — see handoff/deploy_plan.md).
#
# Usage:
#   sudo bash install.sh --name=my-salon-client --domain=booking.example.com --email=admin@example.com
# Any of --name/--domain/--email may be omitted and will be prompted for
# interactively instead.
#
# Ubuntu (apt-based) only — fails fast on anything else.
#
# SECURITY: this script generates and handles real secrets (AUTH_SECRET,
# CRON_SECRET, the SUPERADMIN password). Never add `set -x`, `echo "$VAR"`,
# or similar around the sections that generate/write them — the only place
# they may be printed is the final summary and CREDENTIALS.txt, both written
# chmod 600, at the very end of this script.

set -euo pipefail

INSTALL_ROOT="/opt/salon-booking"
PORTS_FILE="$INSTALL_ROOT/.ports"
REPO_URL="https://github.com/Sviat91/salon-booking-v2.git"

# ---------------------------------------------------------------------------
# Step 1: require root + Ubuntu/apt (AD-9)
# ---------------------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: this script must be run as root (e.g. via sudo)." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "ERROR: this script only supports Ubuntu 22.04/24.04 LTS (apt-based hosts)." >&2
  echo "No other distributions are supported by this installer." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 2: parse args, prompt for anything missing
# ---------------------------------------------------------------------------
PROJECT_NAME=""
DOMAIN=""
EMAIL=""

for arg in "$@"; do
  case "$arg" in
    --name=*) PROJECT_NAME="${arg#*=}" ;;
    --domain=*) DOMAIN="${arg#*=}" ;;
    --email=*) EMAIL="${arg#*=}" ;;
    *)
      echo "ERROR: unknown argument: $arg" >&2
      echo "Supported: --name=<slug> --domain=<domain> --email=<email>" >&2
      exit 1
      ;;
  esac
done

NAME_RE='^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'
EMAIL_RE='^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
DOMAIN_RE='^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$'

# `curl | bash` (the documented one-liner) pipes this script's own source into
# stdin, so plain `read` would read the script text instead of the operator's
# answers. Read from /dev/tty explicitly so prompts still work in that mode.
require_tty() {
  if [ ! -r /dev/tty ]; then
    echo "ERROR: $1 was not provided and no interactive terminal is available to prompt for it." >&2
    echo "Re-run with --name=... --domain=... --email=... to supply it non-interactively." >&2
    exit 1
  fi
}

if [ -z "$PROJECT_NAME" ]; then
  require_tty "--name"
  while true; do
    read -r -p "Instance name (lowercase slug, e.g. my-salon-client): " PROJECT_NAME < /dev/tty
    if [[ "$PROJECT_NAME" =~ $NAME_RE ]]; then
      break
    fi
    echo "Invalid name: must match ${NAME_RE} (lowercase letters/digits/hyphens, 3-50 chars)." >&2
  done
else
  if [[ ! "$PROJECT_NAME" =~ $NAME_RE ]]; then
    echo "ERROR: --name value '$PROJECT_NAME' is invalid: must match ${NAME_RE}." >&2
    exit 1
  fi
fi

if [ -z "$DOMAIN" ]; then
  require_tty "--domain"
  while true; do
    read -r -p "Domain (must already point an A record at this VPS, e.g. booking.example.com): " DOMAIN < /dev/tty
    if [[ "$DOMAIN" =~ $DOMAIN_RE ]]; then
      break
    fi
    echo "Invalid domain." >&2
  done
else
  if [[ ! "$DOMAIN" =~ $DOMAIN_RE ]]; then
    echo "ERROR: --domain value '$DOMAIN' is invalid." >&2
    exit 1
  fi
fi

if [ -z "$EMAIL" ]; then
  require_tty "--email"
  while true; do
    read -r -p "Admin email (used for the SUPERADMIN login and Let's Encrypt renewal notices): " EMAIL < /dev/tty
    if [[ "$EMAIL" =~ $EMAIL_RE ]]; then
      break
    fi
    echo "Invalid email." >&2
  done
else
  if [[ ! "$EMAIL" =~ $EMAIL_RE ]]; then
    echo "ERROR: --email value '$EMAIL' is invalid." >&2
    exit 1
  fi
fi

INSTANCE_DIR="$INSTALL_ROOT/$PROJECT_NAME"
COMPOSE_PROJECT="salon-${PROJECT_NAME}"

# ---------------------------------------------------------------------------
# Step 3: AD-8 idempotency check — abort loudly, never overwrite
# ---------------------------------------------------------------------------
if [ -d "$INSTANCE_DIR" ]; then
  echo "ERROR: instance '$PROJECT_NAME' already installed at $INSTANCE_DIR." >&2
  echo "This script does not support updating an existing instance yet — first install only." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 4: install prerequisites
# ---------------------------------------------------------------------------
echo "Installing prerequisites (this may take a minute)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git openssl ca-certificates gettext-base iproute2 \
  nginx certbot python3-certbot-nginx

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
apt-get install -y docker-compose-plugin
systemctl enable --now docker

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: 'docker compose' plugin is not available after installation." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 5: Turnstile keys (required, per user decision — cannot be automated:
# the operator registers the domain on Cloudflare Turnstile beforehand).
# ---------------------------------------------------------------------------
require_tty "Turnstile keys"
read -r -p "Cloudflare Turnstile site key: " TURNSTILE_SITE_KEY < /dev/tty
read -r -p "Cloudflare Turnstile secret key: " TURNSTILE_SECRET_KEY < /dev/tty
if [ -z "$TURNSTILE_SITE_KEY" ] || [ -z "$TURNSTILE_SECRET_KEY" ]; then
  echo "ERROR: both Turnstile keys are required — the booking form's bot protection needs them." >&2
  exit 1
fi

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

# ---------------------------------------------------------------------------
# Step 6: AD-4 port allocation, idempotent across re-runs
# ---------------------------------------------------------------------------
mkdir -p "$INSTALL_ROOT"
touch "$PORTS_FILE"

EXISTING_PORT="$(grep "^${PROJECT_NAME}=" "$PORTS_FILE" | tail -n1 | cut -d= -f2 || true)"
if [ -n "$EXISTING_PORT" ]; then
  APP_PORT="$EXISTING_PORT"
else
  APP_PORT=3001
  while ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ":${APP_PORT}\$"; do
    APP_PORT=$((APP_PORT + 1))
  done
  echo "${PROJECT_NAME}=${APP_PORT}" >> "$PORTS_FILE"
fi

# ---------------------------------------------------------------------------
# Step 7 (part 1): AD-7 secret generation — never echoed except at the end.
# ---------------------------------------------------------------------------
AUTH_SECRET="$(openssl rand -base64 32)"
CRON_SECRET="$(openssl rand -base64 32)"
ADMIN_PASSWORD="$(openssl rand -base64 18)"

# ---------------------------------------------------------------------------
# Step 8: clone the repo into the instance directory, create data/uploads dirs
# ---------------------------------------------------------------------------
echo "Cloning $REPO_URL into $INSTANCE_DIR..."
git clone --depth 1 "$REPO_URL" "$INSTANCE_DIR"
mkdir -p "$INSTANCE_DIR/data" "$INSTANCE_DIR/uploads"

# ---------------------------------------------------------------------------
# Step 7 (part 2): write .env (chmod 600) — never `cat` this file, never log it.
# ---------------------------------------------------------------------------
cat > "$INSTANCE_DIR/.env" <<ENVEOF
DATABASE_URL="file:./prisma/app.db"
AUTH_SECRET="${AUTH_SECRET}"
# Required behind a reverse proxy (AD-1 — Nginx is always the public edge here).
# Without it, Auth.js/NextAuth refuses to trust the Host/X-Forwarded-* headers
# Nginx forwards and throws "UntrustedHost" internally in production, which
# surfaces to users as a generic 500 "problem with the server configuration"
# on every /api/auth/* call — including the middleware check that decides
# whether /auth/login should redirect. Not user-configurable; always true here.
AUTH_TRUST_HOST="true"
# Explicit canonical URL, on top of AUTH_TRUST_HOST above — without this,
# some Auth.js redirect responses (observed: the sign-out callback URL) can
# still resolve against the container's own internal hostname:port instead
# of the public domain, sending the browser to an unreachable address like
# http://<container-id>:3000. AUTH_URL removes the ambiguity entirely.
AUTH_URL="https://${DOMAIN}"
CRON_SECRET="${CRON_SECRET}"
NEXT_PUBLIC_TURNSTILE_SITE_KEY="${TURNSTILE_SITE_KEY}"
TURNSTILE_SECRET_KEY="${TURNSTILE_SECRET_KEY}"
UPSTASH_REDIS_REST_URL="${UPSTASH_REDIS_REST_URL}"
UPSTASH_REDIS_REST_TOKEN="${UPSTASH_REDIS_REST_TOKEN}"
NEXT_PUBLIC_SITE_URL="https://${DOMAIN}"
ENVEOF
chmod 600 "$INSTANCE_DIR/.env"
chown root:root "$INSTANCE_DIR/.env"

# ---------------------------------------------------------------------------
# Step 9: render docker-compose.yml from the template
# ---------------------------------------------------------------------------
# shellcheck disable=SC2016 # intentional: this is envsubst's explicit variable
# allowlist, must stay single-quoted/unexpanded or nothing would restrict which
# $VAR tokens get substituted.
PROJECT_NAME="$PROJECT_NAME" APP_PORT="$APP_PORT" \
  envsubst '${PROJECT_NAME} ${APP_PORT}' \
  < "$INSTANCE_DIR/deploy/docker-compose.yml.template" \
  > "$INSTANCE_DIR/docker-compose.yml"

# ---------------------------------------------------------------------------
# Step 10: build and start the container
# ---------------------------------------------------------------------------
echo "Building and starting the app container..."
(cd "$INSTANCE_DIR" && docker compose -p "$COMPOSE_PROJECT" up -d --build)

# ---------------------------------------------------------------------------
# Step 11: wait for health, then bootstrap the SUPERADMIN (one-off, not part
# of docker-entrypoint.sh — create-admin.ts already refuses if one exists,
# but running it on every restart is unnecessary noise/risk).
# ---------------------------------------------------------------------------
echo "Waiting for the app to become healthy on 127.0.0.1:${APP_PORT}..."
attempt=0
until curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "ERROR: app did not become healthy after 120s. Check: docker compose -p ${COMPOSE_PROJECT} logs" >&2
    exit 1
  fi
  sleep 2
done

echo "Creating the SUPERADMIN account..."
# `< /dev/null` matters: this whole script is normally run as `curl ... | sudo
# bash`, so bash's own stdin (fd 0) is the pipe it's still reading the rest of
# THIS script from. `docker compose exec -T` disables the pseudo-TTY but still
# attaches to inherited stdin by default — without this redirect it grabs
# bytes off that same pipe, bash hits EOF on its own script early, and
# everything after this line (Nginx, certbot, the final summary with the
# password) silently never runs, with no visible error.
(cd "$INSTANCE_DIR" && docker compose -p "$COMPOSE_PROJECT" exec -T app \
  node_modules/.bin/tsx scripts/create-admin.ts \
  "--email=${EMAIL}" "--password=${ADMIN_PASSWORD}" "--name=Super Admin" < /dev/null)

# ---------------------------------------------------------------------------
# Step 12: Nginx site
# ---------------------------------------------------------------------------
# shellcheck disable=SC2016 # intentional: envsubst's variable allowlist, see
# the identical justification above at the docker-compose.yml render step —
# must not be shell-expanded here, it's an argument to envsubst itself.
DOMAIN="$DOMAIN" APP_PORT="$APP_PORT" INSTANCE_DIR="$INSTANCE_DIR" \
  envsubst '${DOMAIN} ${APP_PORT} ${INSTANCE_DIR}' \
  < "$INSTANCE_DIR/deploy/nginx.conf.template" \
  > "/etc/nginx/sites-available/${PROJECT_NAME}.conf"
ln -sf "/etc/nginx/sites-available/${PROJECT_NAME}.conf" "/etc/nginx/sites-enabled/${PROJECT_NAME}.conf"

if ! nginx -t; then
  echo "ERROR: nginx configuration test failed (see output above) — not proceeding to certbot." >&2
  exit 1
fi
systemctl reload nginx

# ---------------------------------------------------------------------------
# Step 13: TLS via certbot
# ---------------------------------------------------------------------------
echo "Requesting a TLS certificate for ${DOMAIN}..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect

# ---------------------------------------------------------------------------
# Step 14: AD-6 reminders cron
# ---------------------------------------------------------------------------
CRON_FILE="/etc/cron.d/salon-${PROJECT_NAME}-reminders"
cat > "$CRON_FILE" <<CRONEOF
0 * * * * root curl -fsS -m 10 -H "Authorization: Bearer ${CRON_SECRET}" https://${DOMAIN}/api/cron/reminders >> /var/log/salon-${PROJECT_NAME}-cron.log 2>&1
CRONEOF
chmod 600 "$CRON_FILE"
chown root:root "$CRON_FILE"

# ---------------------------------------------------------------------------
# Step 15: CREDENTIALS.txt + final summary (the ONLY place secrets are printed)
# ---------------------------------------------------------------------------
CREDENTIALS_FILE="$INSTANCE_DIR/CREDENTIALS.txt"
cat > "$CREDENTIALS_FILE" <<CREDEOF
Salon Booking — instance "${PROJECT_NAME}"
Installed: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

URL:            https://${DOMAIN}
Admin login:    https://${DOMAIN}/auth/login
SUPERADMIN email:    ${EMAIL}
SUPERADMIN password: ${ADMIN_PASSWORD}

Copy this information out now, then delete this file:
  rm ${CREDENTIALS_FILE}
CREDEOF
chmod 600 "$CREDENTIALS_FILE"
chown root:root "$CREDENTIALS_FILE"

echo ""
echo "================================================================"
echo "Salon Booking instance \"${PROJECT_NAME}\" installed successfully."
echo "================================================================"
echo "URL:                 https://${DOMAIN}"
echo "Admin login:         https://${DOMAIN}/auth/login"
echo "SUPERADMIN email:    ${EMAIL}"
echo "SUPERADMIN password: ${ADMIN_PASSWORD}"
echo ""
echo "The same information was written to: ${CREDENTIALS_FILE}"
echo "Copy it out now, then delete that file (it contains the password in plain text):"
echo "  rm ${CREDENTIALS_FILE}"
echo "================================================================"

# One-command deployment

Installs a fully working, HTTPS-secured Salon Booking instance on a fresh
Ubuntu 22.04/24.04 LTS VPS: Docker-hosted app, host-level Nginx + Certbot for
TLS, hourly reminder cron. Supports multiple independent client instances on
the same VPS — each install is namespaced by `--name`.

Before running it, have ready:

1. **A domain already pointed at the VPS's IP** — an A record for the
   domain, created before you run the installer (Let's Encrypt's HTTP
   challenge needs this to already resolve).
2. **An Upstash Redis database (free tier is enough)** — sign up at
   upstash.com, create a database, the installer will prompt for the REST
   URL and token. Without this, rate limiting is silently disabled
   (`rateLimit()` has no fallback, unlike the app's cache which degrades to
   in-memory automatically).
3. **A Cloudflare Turnstile site registered for that domain** — get the site
   key and secret key from the Cloudflare dashboard; the installer will
   prompt for them (this is a standard 2-minute manual step and can't be
   automated).
4. **An admin email** — used both for the SUPERADMIN login and for Let's
   Encrypt renewal notices.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/Sviat91/salon-booking-v2/master/deploy/install.sh | sudo bash -s -- --name=my-salon-client --domain=booking.example.com --email=admin@example.com
```

`--name`/`--domain`/`--email` may be omitted and will be prompted for
interactively instead. Turnstile keys and Upstash Redis keys are always
prompted for interactively — there is no flag for either.

This only works because you trust your own repo/script — the same pattern as
Docker's or nvm's own install scripts, not a security gap.

At the end, the script prints the instance URL, the admin login URL, and the
generated SUPERADMIN email/password, and writes the same information to
`/opt/salon-booking/<name>/CREDENTIALS.txt` (chmod 600). Copy it out and
delete that file.

## Re-running

Re-running the script for the same `--name` aborts cleanly — it does not
update, overwrite, or regenerate credentials for an existing instance.
Updating an already-deployed instance is not supported by this script; use a
different `--name` to install a separate, independent instance.

## What it does

- Installs Docker, the Docker Compose plugin, Nginx, and Certbot (Ubuntu/apt
  only).
- Clones the repo into `/opt/salon-booking/<name>/`, generates `.env`
  (`AUTH_SECRET`/`CRON_SECRET` via `openssl rand`, plus your Turnstile keys
  and Upstash Redis keys), and builds/starts the app container (`docker
  compose -p salon-<name>`), publishing it to `127.0.0.1:<port>` only —
  Nginx is the sole public edge.
- Bootstraps the first SUPERADMIN account (`scripts/create-admin.ts`).
- Writes an Nginx site file and runs `certbot --nginx` to obtain a real
  certificate and enable the 80→443 redirect.
- Installs an hourly cron entry (`/etc/cron.d/salon-<name>-reminders`) that
  calls `GET /api/cron/reminders` — without it, appointment reminders never
  fire.

## Проверка на тестовом VPS перед боевым клиентом

Этот скрипт не тестировался end-to-end (нет доступа к VPS/Docker/DNS в
песочнице разработки). Перед первым реальным клиентом обязательно прогнать
этот чек-лист вручную на одноразовом тестовом Ubuntu VPS.

1. **Первый запуск целиком.**
   Запустить установочную команду с `--name`/`--domain`/`--email` на чистом
   VPS, дождаться завершения без ошибок. Проверить, что скрипт напечатал URL,
   логин админа и пароль, и что тот же текст лежит в `CREDENTIALS.txt`.

2. **HTTPS и вход в систему.**
   Открыть `https://<домен>` в браузере — должен грузиться сертификат без
   предупреждений, HTTP должен редиректить на HTTPS. Войти в
   `/auth/login` под сгенерированным SUPERADMIN email/паролем — вход должен
   пройти успешно.

3. **Секреты не утекли.**
   - `history | grep -i -E "AUTH_SECRET|CRON_SECRET|password"` — пусто.
   - `docker compose -p salon-<name> logs | grep -i -E "AUTH_SECRET|CRON_SECRET|password"` — пусто.
   - `ls -l /opt/salon-booking/<name>/.env /opt/salon-booking/<name>/CREDENTIALS.txt /etc/cron.d/salon-<name>-reminders` — все три `600`, владелец `root:root`.

4. **Данные переживают `down && up`.**
   Загрузить тестовое фото (лого/фото мастера) и создать тестовую запись
   (booking) через интерфейс. Выполнить:
   ```bash
   docker compose -p salon-<name> down
   docker compose -p salon-<name> up -d
   ```
   Проверить, что фото и запись на месте (не пропали).

5. **Повторный запуск с тем же `--name` — чистый отказ.**
   Запустить установочный скрипт ещё раз с тем же `--name`. Скрипт должен
   сразу завершиться с ошибкой "instance already installed" и не трогать
   существующий инстанс (данные/контейнер/креды не изменились).

6. **Второй инстанс с другим `--name` на том же VPS.**
   Запустить установку с другим `--name`/`--domain`/`--email` на том же VPS.
   Должен успешно установиться без конфликтов с первым инстансом: свой порт
   (`/opt/salon-booking/.ports`), свой контейнер (`docker compose -p
   salon-<name2> ps`), свой файл в `/etc/nginx/sites-available/`, свой файл в
   `/etc/cron.d/`. Оба инстанса должны продолжать нормально работать
   одновременно.

7. **Cron-эндпоинт напоминаний отвечает 200.**
   ```bash
   curl -i -H "Authorization: Bearer <CRON_SECRET из .env>" https://<домен>/api/cron/reminders
   ```
   Должен вернуть `200`, а не `401`/`500`. Также проверить
   `/var/log/salon-<name>-cron.log` после часа работы — там должны появляться
   успешные вызовы, а не ошибки.

8. **Таймер обновления сертификата certbot активен.**
   ```bash
   systemctl list-timers | grep certbot
   ```
   Таймер должен присутствовать и быть активным (не `inactive`/`dead`).

9. **Загрузка большого файла не упирается в лимит nginx (413).**
   `deploy/nginx.conf.template` уже задаёт `client_max_body_size 5M` (с
   запасом над лимитом самого приложения в 4MB), но это нужно подтвердить
   вживую: загрузить фото размером в несколько мегабайт через форму загрузки
   в приложении и убедиться, что запрос не падает с `413 Request Entity Too
   Large`.

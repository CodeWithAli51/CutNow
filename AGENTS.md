# AGENTS.md

Guide for AI coding agents working on this repository. Read this first — it covers the
architecture, data model, API surface, SMS system, testing, and deployment so you can make
changes safely without breaking the product.

## Project overview

CutNow is a **no-app virtual queue** for barber shops and salons. Customers scan a printed QR
code to join a queue, get automatic SMS reminders as their turn approaches, and track live
position/ETA. Shop owners get a password-protected dashboard to manage the queue and see
daily revenue.

- **Stack:** Python 3.12 · Flask 3.0 · SQLite (WAL) · vanilla JS (no framework) · custom CSS
- **Live demo:** https://cutnow-production.up.railway.app
- **Repo:** https://github.com/CodeWithAli51/CutNow (branch `main`)
- **Entry point:** `app.py` (or `wsgi.py` for the waitress entry)

## Architecture (data flow)

```
Browser (templates/ + static/)  ⇄  Flask routes (app.py)  ⇄  store.py  ⇄  db.py (SQLite)
                                      │
                                      ├─ qr.py        — QR code generation (PNG/SVG)
                                      ├─ sms.py       — SMS providers (console/android/twilio)
                                      └─ reminders.py — background worker thread (turn reminders)
```

Key rule: **only `store.py` talks to the database.** If SQLite is ever swapped for Postgres,
only `db.py` + `store.py` change.

### The two-audience API split (critical for privacy)

- `/api/public/...` — used by customers. **Must NEVER return** revenue, customer lists,
  phone numbers, PINs, or anything not needed to join/track a queue.
- `/api/owner/...` — shop-owner backend, protected by `@owner_required` (session auth via
  `owner_shop_id`). Returns shop PIN, phone, waiting list, stats etc.

When adding an endpoint or adding fields to a response, think about which side it belongs on.

### URL building

`site_base()` in `app.py` returns `Config.BASE_URL` if set, otherwise derives the base from
`request.host_url`. **Always use `site_base()`** (not `Config.BASE_URL`) for any absolute URL
(e.g. join links embedded in QR codes), so links work on Railway without config. The app has
`ProxyFix` enabled, so forwarded `X-Forwarded-Proto/Host` headers are honored.

## Running locally

> Provided commands are for **Windows PowerShell**. Adjust `venv\Scripts\activate`,
> `copy`, and `Remove-Item` for macOS/Linux (activate via `source venv/bin/activate`).

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
Copy-Item .env.example .env   # optional local config
python app.py                 # serves http://localhost:5000
```

- Server runs on port `5000` (or `$env:PORT`). Python is **3.12**, git is installed.
- The reminder worker auto-starts on import when `REMINDER_ENABLED=true` (default).
- Health check: `GET /healthz` → `{"status": "ok"}`.
- `.env` and `*.db` files are gitignored — never commit them.

### Environment variables (see `.env.example`)

| Var | Default | Purpose |
| --- | --- | --- |
| `SECRET_KEY` | dev value | Flask session signing |
| `DATABASE_PATH` | `./cutnow.db` | SQLite file location |
| `BASE_URL` | `http://localhost:5000` | Absolute URL base (overrides host derivation) |
| `PORT` | `5000` | Web server port |
| `SMS_PROVIDER` | `console` | `console`, `android`, or `twilio` |
| `ANDROID_GATEWAY_URL` | — | SMS Gateway app URL (for `android`) |
| `TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER` | — | Twilio credentials (for `twilio`) |
| `REMINDER_ENABLED` | `true` | Start background reminder worker |
| `REMINDER_INTERVAL_SECONDS` | `20` | Worker poll rate |
| `REMINDER_NEAR_POSITION` | `3` | Position at which "near" reminder fires |
| `SESSION_COOKIE_SECURE` | `false` | Set `true` behind HTTPS |

## Database schema (`db.py`)

- **shops** — `id` (urlsafe), unique `code` (6-char, unambiguous alphabet), `name`, `phone`,
  `pin_hash` (login verification via Werkzeug), **`pin`** (plaintext, used for PIN recovery
  SMS / dashboard display), `reminder_enabled`, `created_at`.
- **services** — per-shop `name`, `price`, `duration`, `sort_order`.
- **queue_entries** — `token` (per-customer private link), customer `name`/`phone`, service
  snapshot (`service_name`, `price`, `duration`), `status` (`waiting`/`serving`/`done`),
  timestamps (`joined_at`/`started_at`/`completed_at`), `reminded_stage` (0/1/2).
- **sms_log** — audit trail of every outgoing message `(shop_id, entry_id, phone, message,
  provider, status, created_at)`.

SQLite runs in **WAL mode**. `init_db()` runs at import time inside the Flask app context and
auto-migrates (`pin` column was added via `ALTER TABLE` — keep this column-if-missing pattern
for future migrations).

### Default services per new shop

Haircut ₹300/20m, Shave ₹150/15m, Hair Color ₹800/45m, Beard Trim ₹200/10m.

## Store layer notes (`store.py`)

- Shop codes are generated with a **confusion-free alphabet** (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`).
- PINs are 4 random digits; stored both hashed (→`pin_hash`) and plaintext (→`pin`).
- `queue_snapshot(shop_id)` computes `snapshot` with per-entry `position` and `eta_minutes`
  (sum of previous durations), plus `est_wait`. Used by public pages and reminders.
- `stats(shop_id)` returns today's `revenue`, `customers`, `avg_ticket`, `service_breakdown`.
- All queries are parameterized. `get_connection()` commits on success, rolls back on error.

## SMS system (`sms.py`)

- `get_provider()` selects by `SMS_PROVIDER` and **falls back to `ConsoleSmsProvider`**
  (prints to log) when credentials/URLs are missing — safe for dev and dead-cloud demos.
- **Console** — free/dev, logs to stdout.
- **Android gateway** — free, open source; sends real SMS from an Android phone running the
  "SMS Gateway" app (`ANDROID_GATEWAY_URL`, e.g. `http://192.168.1.50:8080/v1/sms`). POSTs
  `{"phone":"+91...","message":"..."}`; phone is normalized to 10 digits then re-prefixed `+91`.
  Phone must be on the same WiFi as the server.
- **Twilio** — cloud; needs account SID/auth token/from-number; Twilio package is NOT in
  requirements (lazy-imported in `TwilioSmsProvider.__init__`).
- `send_sms(to, message)` returns `(provider_name, status)` where status is `"sent"` or
  `"failed"`. **Never raises** — failures are caught and logged.
- New providers implement `SmsProvider.send(to, message)` and register in `get_provider()`.
- Callers should also write to `sms_log` via `store.log_sms()` for the owner dashboard audit.

### SMS use cases

1. **On signup** — `app.py` `owner_signup` sends shop code + PIN to the owner's phone
   (`sms_sent` returned in response).
2. **PIN recovery** — `POST /api/public/recover-pin` re-sends PIN only if the submitted phone
   matches the shop's stored phone. Lookups are **non-revealing** (always returns `success`
   plus `sent: bool`) and rate-limited.
3. **Turn reminders** — `reminders.py` worker: stage 1 "pending" on join, stage 2 "near" when
   position ≤ `REMINDER_NEAR_POSITION`, plus an immediate "serving" text on `/api/owner/start`.

## Reminder worker (`reminders.py`)

- A daemon thread (`ReminderWorker`) loops every `REMINDER_INTERVAL_SECONDS`, calls
  `run_once()`, sleeps (interruptible via `threading.Event`).
- `run_once()` scans `shops_with_reminders()` and their snapshots; marks `reminded_stage`
  so no duplicate texts per customer.
- **Scalability rule:** keep it in exactly one process — `Procfile` runs gunicorn with
  `--workers 1 --threads 4` so customers are never texted twice. If scaling out later,
  disable in web workers (`REMINDER_ENABLED=false`) and run one dedicated worker.

## HTTP routes

Pages: `/`, `/owner`, `/j/<code>` (scan-to-join), `/c/<token>` (customer status).

Owner API (all behind session auth except signup/login/logout):
`POST /api/owner/signup|login|logout`, `GET /api/owner/shop|stats|sms-log|qr`,
`POST /api/owner/services|start|complete|settings`, `DELETE /api/owner/services/<id>`.
`/api/owner/qr?format=svg` returns SVG download; default returns JSON with a PNG `data_uri`.

Public API: `GET /api/public/shop/<code>`, `POST /api/public/join`, `GET /api/public/entry/<token>`,
`POST /api/public/recover-pin`.

## Frontend conventions

- **Templates** (`templates/`): `index.html` (landing), `dashboard.html` (owner), `join.html`
  (customer join), `status.html` (customer live tracking). They mount a root div + include a
  page-specific JS file.
- **JS** (`static/`): `dashboard.js` (owner SPA-ish, polls every 4s), `join.js`, `status.js`,
  all vanilla. No bundler, no framework.
- Dashboard renders via template literals into `#app`; helper functions: `esc()` (HTML escape),
  `showToast()`, `copyText()`. Never interpolate raw user input without `esc()`.
- **Styling:** utility-first custom CSS in `static/style.css` (indigo/purple theme, classes
  like `bg-indigo-600`, `.toast`, `.skeleton`, `.btn`). No Tailwind build step.
- The dashboard loads `/api/owner/qr` defensively (`fetch(...).catch(...)`) so a QR failure
  never blanks the dashboard — preserve that pattern.

## Testing (no test framework — ad-hoc scripts)

There is **no pytest/unittest suite**. Verify changes with throwaway Python scripts against
the Flask test client. Pattern:

```powershell
# PowerShell
$env:SMS_PROVIDER="console"; $env:DATABASE_PATH="test_tmp.db"; $env:REMINDER_ENABLED="false"
Remove-Item -Force test_tmp.db, test_tmp.db-wal, test_tmp.db-shm -ErrorAction SilentlyContinue
python -c "import app; c=app.app.test_client(); ..."
```

Regression checks that matter (run these when touching anything):
1. Pages `/`, `/owner`, `/healthz` return 200.
2. Signup → returns `pin`, 200; with phone → `sms_sent` true; credentials SMS printed.
3. Login ok; wrong code/PIN → 401.
4. Owner `/api/owner/shop` returns the shop including `pin`; unauthenticated → 401.
5. **Privacy:** `/api/public/shop/<code>` and `/api/public/entry/<token>` responses contain
   NO `pin`, `pin_hash`, `phone`, `current`, or `waiting`.
6. Join flow: add service → join with name+phone → token + position; bad phone → 400;
   rate-limit → 429 after 5 rapid joins.
7. `recover-pin`: wrong phone → `sent:false`; right phone → `sent:true`; 5 rapid attempts → 429.
8. Owner start → 200, complete → 200, complete again → 400.
9. Import sanity: `python -c "import app"` must succeed with `DATABASE_PATH` set to a temp file.

Run `python -c "import app"` at minimum before committing — it catches syntax/import errors
(fastest smoke test).

## Deployment (Railway)

- Railway auto-detects the **`Procfile`**: `web: gunicorn app:app --bind 0.0.0.0:$PORT
  --workers 1 --threads 4`.
- `requirements.txt` (Flask, Flask-CORS, Werkzeug, qrcode, Pillow, python-dotenv, waitress,
  gunicorn) must stay complete — a missing dep is the #1 Railway build failure.
- Deploy lives with **SQLite by default**: data does NOT persist across Railway restarts.
  For durable storage, add Railway Postgres and swap `db.py`/`store.py` (the only DB-touching
  layer). Do not silently restart prod with a fresh DB.
- Suggested Railway vars: `SECRET_KEY`, `BASE_URL`, `SMS_PROVIDER=console`, `SESSION_COOKIE_SECURE=true`.
- Deployment happens automatically on push to `main`.

## Git hygiene

- `.gitignore` covers `.env`, `*.db*`, `venv/`, logs. Never commit those.
- Only commit when asked. Use clear conventional messages.
- Windows CRLF warnings on commit are benign (normalized to LF in repo).

## Common pitfalls

- **Do NOT import `app` without a temp `DATABASE_PATH`** in tests — `init_db()` runs at import
  and will create/modify the real `cutnow.db` (and start the reminder worker unless
  `REMINDER_ENABLED=false`).
- **Never return shop `pin`/`pin_hash`/`phone`/`waiting` from public endpoints.** The
  privacy split is the product's core trust property.
- **Keep QR/join URLs absolute** via `site_base()`; relative links break the printed QR.
- **Twilio and waitress aren't installed in the local venv** — code paths that use them are
  lazy/optional. Don't `import twilio` at module top-level.
- When adding columns, follow the existing migration pattern in `init_db()` (PRAGMA
  table_info check + conditional `ALTER TABLE`); existing prod DBs must not be reprovisioned.
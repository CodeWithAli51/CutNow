# CutNow

A virtual queue for barber shops and salons. Customers **scan a QR code, join the line, and get automatic text reminders** before their turn — no app, no waiting room.

## Why it works

People overestimate how long they've waited by ~36%, and "occupied" time feels shorter than idle time. Showing a live position + ETA, and sending a text when it's nearly their turn, measurably reduces no-shows and keeps customers from walking away.

## Features

- **Scan-to-join** — one QR per shop (`/j/<code>`). No shop ID to type.
- **Automatic SMS reminders** — sent when a customer joins and again when they're near the front.
- **Live status page** — private per-customer link (`/c/<token>`) with position, ETA and a progress bar.
- **Owner dashboard** — login with shop code + PIN, live queue, start/complete service, QR download, services & pricing, daily stats.
- **Privacy by design** — the public/customer API never exposes revenue, customer lists or phone numbers.
- **Production ready** — SQLite (WAL) with parameterized queries, session auth, rate-limited joins, env-based config.

## Quick start

```bash
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env       # then edit SECRET_KEY, BASE_URL
python app.py
```

Open http://localhost:5000, click **Set up your shop**, and save the PIN shown.

With `SMS_PROVIDER=console` (the default), reminder texts are printed to the console/log so you can test without any SMS account. To send real texts, set `SMS_PROVIDER=twilio` and the `TWILIO_*` vars.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Landing page |
| `/owner` | Owner dashboard (login / signup) |
| `/j/<code>` | Public scan-to-join page |
| `/c/<token>` | Private customer status page |
| `/api/public/...` | Privacy-safe customer API |
| `/api/owner/...` | Authenticated owner API |
| `/healthz` | Health check |

## Running in production

```bash
python wsgi.py     # waitserve, multi-threaded
```

Put it behind a reverse proxy (Nginx / Caddy / a cloud load balancer) for TLS. Set `SESSION_COOKIE_SECURE=true` once you're on HTTPS.

### Scaling

The app is written so you can scale out without rewriting:

- **Stateless web tier** — sessions are cookie-based, so you can run multiple instances behind a load balancer.
- **Shared database** — point `DATABASE_PATH` at a networked volume, or swap `db.py`/`store.py` for PostgreSQL (the store layer is the only thing that talks to the DB).
- **Single reminder worker** — run the reminder loop in a dedicated process (or a cron hitting an endpoint) rather than in every web worker, so customers aren't texted twice. Set `REMINDER_ENABLED=false` on web instances and run one worker.
- **Real SMS at volume** — replace the Twilio adapter in `sms.py` with any provider; the interface is one `send(to, message)` method.

## Configuration

All via environment variables / `.env` — see `.env.example`.
</｜｜DSML｜｜ parameter>
</｜｜DSML｜｜ invoke>
</｜｜DSML｜｜ calls>
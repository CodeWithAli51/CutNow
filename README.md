<p align="center">
  <img src="https://img.shields.io/badge/CutNow-virtual%20queue-indigo" alt="CutNow">
  <img src="https://img.shields.io/badge/Flask-3.0.0-blue" alt="Flask">
  <img src="https://img.shields.io/badge/demo-live%20on%20Railway-success" alt="Live on Railway">
</p>

<h1 align="center">✂️ CutNow</h1>
<p align="center">
  <strong>The no-app virtual queue for barber shops &amp; salons.</strong><br>
  Customers scan a QR, join the line, and get automatic text reminders before their turn — no waiting room, no hovering, no no-shows.
</p>

<p align="center">
  <a href="https://cutnow-production.up.railway.app">🚀 Live demo — cutnow-production.up.railway.app</a>
</p>

---

## Why it works

People *overestimate* how long they've waited by ~36%, and "occupied time" feels shorter
than idle time. CutNow leans into that psychology:

- Customers see a **live position + ETA** instead of helplessly hovering.
- A **text reminder** lands when their turn is near, so they step away and come back on time.
- Result: **fewer no-shows**, **less crowding**, and customers who rate the experience higher.

## Features

| | |
| --- | --- |
| 🖨️ **Scan-to-join** | One printed QR per shop (`/j/<code>`). No shop IDs to type, no app to install. |
| 📱 **Automatic SMS reminders** | Pings customers when they join and again right before their turn. |
| 🔗 **Private status page** | Per-customer link (`/c/<token>`) with position, ETA, and a progress bar. |
| 🧑‍💼 **Owner dashboard** | Shop code + PIN login, live queue, start/complete service, daily stats & revenue. |
| 🔑 **PIN by SMS** | Your shop code and PIN are texted straight to your phone when you sign up — and can be re-sent anytime if you forget. |
| 🕶️ **Privacy by design** | The public/customer API never exposes revenue, customer lists, or phone numbers. |
| ⚡ **Production ready** | SQLite (WAL) with parameterized queries, session auth, rate-limited joins, env-based config. |

## Try it live

1. Open the demo: **https://cutnow-production.up.railway.app**
2. Click **Set up your shop** (or log in with a shop code).
3. Print/grab the QR, scan it as your "customer," join the queue, and watch the status page update in real time.

## Quick start (self-host)

```bash
python -m venv venv
venv\Scripts\activate            # Windows       (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env           # Windows       (macOS/Linux: cp .env.example .env)
python app.py
```

Open **http://localhost:5000** → click **Set up your shop** → note the shop code + PIN
(and they're texted to your phone for safekeeping).

> When you set up a shop, add your phone number — CutNow will **SMS you your shop code
> and PIN**. Forgot the PIN later? Use **"Forgot your PIN?"** on the login screen.
> No SMS account needed while testing: with `SMS_PROVIDER=console` texts are printed to the log.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Landing page |
| `/owner` | Owner dashboard (sign up / log in) |
| `/j/<code>` | Public scan-to-join page |
| `/c/<token>` | Private customer status page |
| `/api/public/...` | Privacy-safe customer API |
| `/api/owner/...` | Authenticated owner API |
| `/healthz` | Health check |

## SMS providers

CutNow ships with three providers — pick one via `SMS_PROVIDER` in `.env`.

| Provider | Cost | How it works |
| --- | --- | --- |
| `console` | Free | Prints every text to the log. Perfect for development. |
| `android` | **Free, open source** | Sends real SMS from your own Android phone (any SIM) with the SMS Gateway app — great for low-volume testing and local use. |
| `twilio` | Paid | Cloud SMS + WhatsApp — best for production at scale. |

Details and setup for the Android gateway are in [`.env.example`](.env.example).

## Deployment (Railway)

1. Push this repo to GitHub and create a new **Railway** project from the repo.
2. Railway auto-detects the `Procfile`:
   ```
   web: gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 4
   ```
3. Set these **Variables** in Railway:
   - `SECRET_KEY` — long random string
   - `BASE_URL` — your `*.up.railway.app` URL
   - `SMS_PROVIDER=console` to start (switch to `twilio` for real texts)
   - `SESSION_COOKIE_SECURE=true`
4. Deploy and open the generated URL.

> **Note:** SQLite works but doesn't persist across Railway restarts. For durable data,
> add Railway Postgres and point the store layer at it (only `db.py`/`store.py` touch the DB).

## Project structure

```
app.py          Flask app — all routes (public + owner APIs)
config.py       Env-based configuration
db.py           SQLite schema + connection helpers (WAL)
store.py        Data access layer (the only module that talks to the DB)
sms.py          SMS providers: console / android / twilio
reminders.py    Background worker that sends turn reminders
qr.py           QR code generation (PNG / SVG)
templates/      index, dashboard, join, status pages
static/         Dashboard, join & status JavaScript + styles
wsgi.py         Waitress WSGI entry point
Procfile        Railway start command
```

## License

MIT — build something great with it.
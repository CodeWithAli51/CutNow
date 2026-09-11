import logging
import re
import time
from collections import defaultdict
from functools import wraps

from flask import Flask, jsonify, redirect, render_template, request, session, url_for

import qr
import reminders
import store
from config import Config
from db import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("cutnow")

app = Flask(__name__)
app.config.update(
    SECRET_KEY=Config.SECRET_KEY,
    SESSION_COOKIE_HTTPONLY=Config.SESSION_COOKIE_HTTPONLY,
    SESSION_COOKIE_SAMESITE=Config.SESSION_COOKIE_SAMESITE,
    SESSION_COOKIE_SECURE=Config.SESSION_COOKIE_SECURE,
    MAX_CONTENT_LENGTH=256 * 1024,
)

PHONE_RE = re.compile(r"^\+?\d{7,15}$")
_join_hits = defaultdict(list)


def rate_limited(key, limit=5, window=60):
    now = time.time()
    hits = [t for t in _join_hits[key] if now - t < window]
    _join_hits[key] = hits
    if len(hits) >= limit:
        return True
    hits.append(now)
    return False


def owner_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        shop_id = session.get("owner_shop_id")
        if not shop_id:
            return jsonify({"error": "Authentication required"}), 401
        shop = store.get_shop_by_id(shop_id)
        if not shop:
            session.clear()
            return jsonify({"error": "Authentication required"}), 401
        request.shop = shop
        return fn(*args, **kwargs)

    return wrapper


def public_shop(shop):
    services = store.list_services(shop["id"])
    snap = store.queue_snapshot(shop["id"])
    return {
        "code": shop["code"],
        "name": shop["name"],
        "services": services,
        "waiting_count": len(snap["waiting"]),
        "est_wait_minutes": snap["est_wait"],
        "now_serving": snap["current"]["service_name"] if snap["current"] else None,
    }


# ---------- pages ----------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/owner")
def owner_page():
    return render_template("dashboard.html")


@app.route("/j/<code>")
def join_page(code):
    shop = store.get_shop_by_code(code)
    if not shop:
        return render_template("join.html", shop=None, code=code), 404
    return render_template("join.html", shop=public_shop(shop), code=code.upper())


@app.route("/c/<token>")
def status_page(token):
    entry = store.get_entry_by_token(token)
    if not entry:
        return render_template("status.html", entry=None, token=token), 404
    return render_template("status.html", entry={"name": entry["name"], "service": entry["service_name"]}, token=token)


# ---------- owner auth ----------

@app.route("/api/owner/signup", methods=["POST"])
def owner_signup():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    if not name or len(name) > 80:
        return jsonify({"error": "Please enter a valid shop name"}), 400
    shop = store.create_shop(name, phone or None)
    session["owner_shop_id"] = shop["id"]
    log.info("New shop created code=%s", shop["code"])
    return jsonify({"success": True, "code": shop["code"], "pin": shop["pin"], "name": shop["name"]})


@app.route("/api/owner/login", methods=["POST"])
def owner_login():
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip().upper()
    pin = (data.get("pin") or "").strip()
    shop = store.get_shop_by_code(code)
    if not store.verify_pin(shop, pin):
        return jsonify({"error": "Invalid shop code or PIN"}), 401
    session["owner_shop_id"] = shop["id"]
    return jsonify({"success": True})


@app.route("/api/owner/logout", methods=["POST"])
def owner_logout():
    session.clear()
    return jsonify({"success": True})


# ---------- owner data ----------

@app.route("/api/owner/shop")
@owner_required
def owner_shop():
    shop = request.shop
    snap = store.queue_snapshot(shop["id"])
    return jsonify({
        "code": shop["code"],
        "name": shop["name"],
        "phone": shop["phone"],
        "reminder_enabled": bool(shop["reminder_enabled"]),
        "services": store.list_services(shop["id"]),
        "current": snap["current"],
        "waiting": snap["waiting"],
        "est_wait_minutes": snap["est_wait"],
        "join_url": f"{Config.BASE_URL}/j/{shop['code']}",
    })


@app.route("/api/owner/stats")
@owner_required
def owner_stats():
    return jsonify(store.stats(request.shop["id"]))


@app.route("/api/owner/sms-log")
@owner_required
def owner_sms_log():
    return jsonify({"messages": store.list_sms_log(request.shop["id"])})


@app.route("/api/owner/qr")
@owner_required
def owner_qr():
    url = f"{Config.BASE_URL}/j/{request.shop['code']}"
    fmt = (request.args.get("format") or "png").lower()
    if fmt == "svg":
        return app.response_class(qr.svg_string(url), mimetype="image/svg+xml")
    return jsonify({"data_uri": qr.png_data_uri(url), "url": url})


@app.route("/api/owner/services", methods=["POST"])
@owner_required
def owner_add_service():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    try:
        price = int(data.get("price"))
        duration = int(data.get("duration"))
    except (TypeError, ValueError):
        return jsonify({"error": "Price and duration must be numbers"}), 400
    if not name or price < 0 or duration <= 0:
        return jsonify({"error": "Please provide a valid name, price and duration"}), 400
    service = store.add_service(request.shop["id"], name, price, duration)
    return jsonify({"success": True, "service": service})


@app.route("/api/owner/services/<int:service_id>", methods=["DELETE"])
@owner_required
def owner_delete_service(service_id):
    store.delete_service(request.shop["id"], service_id)
    return jsonify({"success": True})


@app.route("/api/owner/settings", methods=["POST"])
@owner_required
def owner_update_settings():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    reminder_enabled = data.get("reminder_enabled")
    if name and len(name) > 80:
        return jsonify({"error": "Shop name is too long"}), 400
    store.update_shop(
        request.shop["id"],
        name=name or None,
        phone=phone if phone else None,
        reminder_enabled=bool(reminder_enabled) if reminder_enabled is not None else None,
    )
    return jsonify({"success": True})


# ---------- owner queue controls ----------

@app.route("/api/owner/start", methods=["POST"])
@owner_required
def owner_start():
    current = store.start_next(request.shop["id"])
    if not current:
        return jsonify({"error": "No customer waiting"}), 400
    reminders.notify(request.shop, current, "serving", 0)
    return jsonify({"success": True, "current": current})


@app.route("/api/owner/complete", methods=["POST"])
@owner_required
def owner_complete():
    done = store.complete_current(request.shop["id"])
    if not done:
        return jsonify({"error": "No customer being served"}), 400
    return jsonify({"success": True, "completed": done})


# ---------- public customer API (no private data) ----------

@app.route("/api/public/shop/<code>")
def public_shop_info(code):
    shop = store.get_shop_by_code(code)
    if not shop:
        return jsonify({"error": "Shop not found"}), 404
    return jsonify(public_shop(shop))


@app.route("/api/public/join", methods=["POST"])
def public_join():
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip().upper()
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    service_id = data.get("service_id")

    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "unknown").split(",")[0].strip()
    if rate_limited(ip):
        return jsonify({"error": "Too many requests. Please wait a moment."}), 429

    shop = store.get_shop_by_code(code)
    if not shop:
        return jsonify({"error": "Shop not found"}), 404
    if not name or len(name) > 60:
        return jsonify({"error": "Please enter your name"}), 400
    if not PHONE_RE.match(phone):
        return jsonify({"error": "Please enter a valid phone number"}), 400

    try:
        service = store.get_service(shop["id"], int(service_id))
    except (TypeError, ValueError):
        service = None
    if not service:
        return jsonify({"error": "Please choose a service"}), 400

    entry = store.create_entry(shop["id"], name, phone, service)
    position = store.position_of(shop["id"], entry["id"])
    log.info("Entry %s joined shop %s (pos %s)", entry["id"], shop["code"], position)
    return jsonify({
        "success": True,
        "token": entry["token"],
        "status_url": url_for("status_page", token=entry["token"]),
        "position": position,
        "service": service["name"],
    })


@app.route("/api/public/entry/<token>")
def public_entry_status(token):
    entry = store.get_entry_by_token(token)
    if not entry:
        return jsonify({"error": "Not found"}), 404

    if entry["status"] == "waiting":
        position = store.position_of(entry["shop_id"], entry["id"])
        snap = store.queue_snapshot(entry["shop_id"])
        eta = next((i["eta_minutes"] for i in snap["snapshot"] if i["entry"]["id"] == entry["id"]), None)
        return jsonify({
            "status": "waiting",
            "position": position,
            "eta_minutes": eta,
            "service": entry["service_name"],
            "name": entry["name"],
            "people_ahead": (position - 1) if position else 0,
        })

    if entry["status"] == "serving":
        return jsonify({"status": "serving", "service": entry["service_name"], "name": entry["name"]})

    return jsonify({"status": "done", "service": entry["service_name"], "name": entry["name"]})


# ---------- health ----------

@app.route("/healthz")
def healthz():
    return jsonify({"status": "ok"})


with app.app_context():
    init_db()
    if Config.REMINDER_ENABLED:
        reminders.worker.start()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=Config.PORT, debug=False, threaded=True)
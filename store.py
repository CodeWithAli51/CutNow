import secrets
import string
from datetime import datetime, timezone

from werkzeug.security import check_password_hash, generate_password_hash

from db import get_connection

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

DEFAULT_SERVICES = [
    ("Haircut", 300, 20),
    ("Shave", 150, 15),
    ("Hair Color", 800, 45),
    ("Beard Trim", 200, 10),
]


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _gen_code(length=6):
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))


def _gen_id():
    return secrets.token_urlsafe(12)


def _gen_token():
    return secrets.token_urlsafe(24)


def _gen_pin(length=4):
    return "".join(secrets.choice(string.digits) for _ in range(length))


def _row_to_dict(row):
    return dict(row) if row is not None else None


def create_shop(name, phone=None):
    shop_id = _gen_id()
    pin = _gen_pin()
    with get_connection() as conn:
        for _ in range(5):
            code = _gen_code()
            exists = conn.execute("SELECT 1 FROM shops WHERE code = ?", (code,)).fetchone()
            if not exists:
                break
        conn.execute(
            "INSERT INTO shops (id, code, name, phone, pin_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (shop_id, code, name, phone, generate_password_hash(pin), now_iso()),
        )
        for i, (sname, price, duration) in enumerate(DEFAULT_SERVICES):
            conn.execute(
                "INSERT INTO services (shop_id, name, price, duration, sort_order) VALUES (?, ?, ?, ?, ?)",
                (shop_id, sname, price, duration, i),
            )
    return {"id": shop_id, "code": code, "name": name, "pin": pin}


def get_shop_by_code(code):
    if not code:
        return None
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM shops WHERE code = ?", (code.strip().upper(),)).fetchone()
    return _row_to_dict(row)


def get_shop_by_id(shop_id):
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM shops WHERE id = ?", (shop_id,)).fetchone()
    return _row_to_dict(row)


def verify_pin(shop, pin):
    if not shop or not pin:
        return False
    return check_password_hash(shop["pin_hash"], str(pin))


def list_services(shop_id):
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, name, price, duration FROM services WHERE shop_id = ? ORDER BY sort_order, id",
            (shop_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def add_service(shop_id, name, price, duration):
    with get_connection() as conn:
        cur = conn.execute(
            "INSERT INTO services (shop_id, name, price, duration, sort_order) VALUES (?, ?, ?, ?, ?)",
            (shop_id, name, int(price), int(duration), 999),
        )
        sid = cur.lastrowid
    return {"id": sid, "name": name, "price": int(price), "duration": int(duration)}


def delete_service(shop_id, service_id):
    with get_connection() as conn:
        conn.execute("DELETE FROM services WHERE shop_id = ? AND id = ?", (shop_id, service_id))


def update_shop(shop_id, name=None, phone=None, reminder_enabled=None):
    fields, values = [], []
    if name is not None:
        fields.append("name = ?")
        values.append(name)
    if phone is not None:
        fields.append("phone = ?")
        values.append(phone)
    if reminder_enabled is not None:
        fields.append("reminder_enabled = ?")
        values.append(1 if reminder_enabled else 0)
    if not fields:
        return
    values.append(shop_id)
    with get_connection() as conn:
        conn.execute(f"UPDATE shops SET {', '.join(fields)} WHERE id = ?", values)


def get_service(shop_id, service_id):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, name, price, duration FROM services WHERE shop_id = ? AND id = ?",
            (shop_id, service_id),
        ).fetchone()
    return _row_to_dict(row)


def create_entry(shop_id, name, phone, service):
    token = _gen_token()
    with get_connection() as conn:
        cur = conn.execute(
            """INSERT INTO queue_entries
               (shop_id, token, name, phone, service_id, service_name, price, duration, status, joined_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?)""",
            (shop_id, token, name, phone, service["id"], service["name"], service["price"], service["duration"], now_iso()),
        )
        entry_id = cur.lastrowid
    return {"id": entry_id, "token": token}


def get_entry_by_token(token):
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM queue_entries WHERE token = ?", (token,)).fetchone()
    return _row_to_dict(row)


def list_waiting(shop_id):
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM queue_entries WHERE shop_id = ? AND status = 'waiting' ORDER BY id",
            (shop_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def get_current(shop_id):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM queue_entries WHERE shop_id = ? AND status = 'serving' ORDER BY id LIMIT 1",
            (shop_id,),
        ).fetchone()
    return _row_to_dict(row)


def start_next(shop_id):
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM queue_entries WHERE shop_id = ? AND status = 'serving'", (shop_id,)
        ).fetchone()
        if existing:
            return None
        row = conn.execute(
            "SELECT id FROM queue_entries WHERE shop_id = ? AND status = 'waiting' ORDER BY id LIMIT 1",
            (shop_id,),
        ).fetchone()
        if not row:
            return None
        conn.execute(
            "UPDATE queue_entries SET status = 'serving', started_at = ? WHERE id = ?",
            (now_iso(), row["id"]),
        )
    return get_current(shop_id)


def complete_current(shop_id):
    current = get_current(shop_id)
    if not current:
        return None
    with get_connection() as conn:
        conn.execute(
            "UPDATE queue_entries SET status = 'done', completed_at = ? WHERE id = ?",
            (now_iso(), current["id"]),
        )
    return current


def position_of(shop_id, entry_id):
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id FROM queue_entries WHERE shop_id = ? AND status = 'waiting' ORDER BY id",
            (shop_id,),
        ).fetchall()
    ids = [r["id"] for r in rows]
    if entry_id not in ids:
        return None
    return ids.index(entry_id) + 1


def queue_snapshot(shop_id):
    waiting = list_waiting(shop_id)
    current = get_current(shop_id)
    lead = current["duration"] if current else 0
    snapshot = []
    running = lead
    for i, entry in enumerate(waiting):
        snapshot.append({
            "entry": entry,
            "position": i + 1,
            "eta_minutes": running,
        })
        running += entry["duration"]
    return {"current": current, "waiting": waiting, "snapshot": snapshot, "est_wait": running}


def mark_reminded(entry_id, stage):
    with get_connection() as conn:
        conn.execute("UPDATE queue_entries SET reminded_stage = ? WHERE id = ?", (stage, entry_id))


def log_sms(shop_id, entry_id, phone, message, provider, status):
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO sms_log (shop_id, entry_id, phone, message, provider, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (shop_id, entry_id, phone, message, provider, status, now_iso()),
        )


def list_sms_log(shop_id, limit=20):
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT phone, message, provider, status, created_at FROM sms_log WHERE shop_id = ? ORDER BY id DESC LIMIT ?",
            (shop_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def shops_with_reminders():
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM shops WHERE reminder_enabled = 1").fetchall()
    return [dict(r) for r in rows]


def stats(shop_id):
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT price, service_name FROM queue_entries WHERE shop_id = ? AND status = 'done' AND date(completed_at) = date('now')",
            (shop_id,),
        ).fetchall()
    total = sum(r["price"] for r in rows)
    count = len(rows)
    breakdown = {}
    for r in rows:
        b = breakdown.setdefault(r["service_name"], {"name": r["service_name"], "count": 0, "revenue": 0})
        b["count"] += 1
        b["revenue"] += r["price"]
    return {
        "today_revenue": total,
        "today_customers": count,
        "avg_ticket": round(total / count) if count else 0,
        "service_breakdown": sorted(breakdown.values(), key=lambda x: -x["revenue"]),
    }
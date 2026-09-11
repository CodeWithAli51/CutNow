import sqlite3
from contextlib import contextmanager

from config import Config

SCHEMA = """
CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    pin_hash TEXT NOT NULL,
    reminder_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS queue_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    service_id INTEGER,
    service_name TEXT NOT NULL,
    price INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting',
    joined_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    reminded_stage INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_queue_shop_status ON queue_entries(shop_id, status, id);
CREATE INDEX IF NOT EXISTS idx_queue_token ON queue_entries(token);
CREATE INDEX IF NOT EXISTS idx_services_shop ON services(shop_id, sort_order);

CREATE TABLE IF NOT EXISTS sms_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT,
    entry_id INTEGER,
    phone TEXT,
    message TEXT,
    provider TEXT,
    status TEXT,
    created_at TEXT
);
"""


def _connect():
    conn = sqlite3.connect(Config.DATABASE_PATH, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


@contextmanager
def get_connection():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_connection() as conn:
        conn.executescript(SCHEMA)
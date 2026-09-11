import logging
import threading
import time

import store
from config import Config
from sms import send_sms

log = logging.getLogger("cutnow.reminders")

PENDING_STAGE = 1
NEAR_STAGE = 2


def _message(kind, shop, entry, position):
    if kind == "pending":
        return (
            f"{shop['name']}: You're in the queue. {position} ahead of you — "
            "we'll text you again as your turn approaches."
        )
    if kind == "near":
        return (
            f"{shop['name']}: You're next! Please head to the shop now. "
            f"Position {position}. Reply or call if you can't make it."
        )
    if kind == "serving":
        return f"{shop['name']}: It's your turn now. Please come in for your {entry['service_name']}."
    return ""


def notify(shop, entry, kind, position):
    message = _message(kind, shop, entry, position)
    if not message:
        return
    provider, status = send_sms(entry["phone"], message)
    store.log_sms(shop["id"], entry["id"], entry["phone"], message, provider, status)
    log.info("Reminder (%s) to %s via %s: %s", kind, entry["phone"], provider, status)


def run_once():
    for shop in store.shops_with_reminders():
        snap = store.queue_snapshot(shop["id"])
        for item in snap["snapshot"]:
            entry = item["entry"]
            position = item["position"]
            stage = entry["reminded_stage"]
            if stage < PENDING_STAGE:
                notify(shop, entry, "pending", position)
                store.mark_reminded(entry["id"], PENDING_STAGE)
                continue
            if stage < NEAR_STAGE and position <= Config.REMINDER_NEAR_POSITION:
                notify(shop, entry, "near", position)
                store.mark_reminded(entry["id"], NEAR_STAGE)


class ReminderWorker:
    def __init__(self, interval=None):
        self.interval = interval or Config.REMINDER_INTERVAL_SECONDS
        self._stop = threading.Event()
        self._thread = None

    def _loop(self):
        while not self._stop.is_set():
            try:
                run_once()
            except Exception as exc:
                log.warning("Reminder cycle failed: %s", exc)
            self._stop.wait(self.interval)

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="reminder-worker", daemon=True)
        self._thread.start()
        log.info("Reminder worker started (interval=%ss)", self.interval)

    def stop(self):
        self._stop.set()


worker = ReminderWorker()
import json
import logging
import os
import re
import urllib.request
import urllib.error

from config import Config

log = logging.getLogger("cutnow.sms")

FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2"


class SmsProvider:
    name = "base"

    def send(self, to, message):
        raise NotImplementedError


class ConsoleSmsProvider(SmsProvider):
    name = "console"

    def send(self, to, message):
        log.info("[SMS -> %s] %s", to, message)
        print(f"\n[SMS -> {to}] {message}\n")
        return "sent"


class Fast2SmsProvider(SmsProvider):
    name = "fast2sms"

    def send(self, to, message):
        digits = re.sub(r"\D", "", to)
        ten_digit = digits[-10:] if len(digits) >= 10 else digits

        body = {
            "route": os.environ.get("FAST2SMS_ROUTE", "q"),
            "message": message,
            "numbers": ten_digit,
        }
        if os.environ.get("FAST2SMS_SENDER_ID"):
            body["sender_id"] = os.environ.get("FAST2SMS_SENDER_ID")
        if os.environ.get("FAST2SMS_TEMPLATE_ID"):
            body["variables_values"] = os.environ.get("FAST2SMS_TEMPLATE_ID")

        payload = json.dumps(body).encode("utf-8")

        req = urllib.request.Request(
            FAST2SMS_URL,
            data=payload,
            headers={
                "authorization": os.environ.get("FAST2SMS_API_KEY", ""),
                "Content-Type": "application/json",
            },
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        if result.get("return") is False:
            err = result.get("message", "unknown error")
            log.warning("Fast2SMS rejected: %s", err)
            raise RuntimeError(f"Fast2SMS error: {err}")

        log.info("Fast2SMS sent to %s: %s", ten_digit, result.get("message", "ok"))
        return "sent"


class TwilioSmsProvider(SmsProvider):
    name = "twilio"

    def __init__(self):
        from twilio.rest import Client
        self.client = Client(Config.TWILIO_ACCOUNT_SID, Config.TWILIO_AUTH_TOKEN)

    def send(self, to, message):
        self.client.messages.create(body=message, from_=Config.TWILIO_FROM_NUMBER, to=to)
        return "sent"


def get_provider():
    provider = Config.SMS_PROVIDER

    if provider == "fast2sms":
        if not os.environ.get("FAST2SMS_API_KEY"):
            log.warning("FAST2SMS_API_KEY not set — falling back to console")
            return ConsoleSmsProvider()
        return Fast2SmsProvider()

    if provider == "twilio":
        if not Config.TWILIO_ACCOUNT_SID or not Config.TWILIO_AUTH_TOKEN:
            log.warning("Twilio credentials not set — falling back to console")
            return ConsoleSmsProvider()
        try:
            return TwilioSmsProvider()
        except Exception as exc:
            log.warning("Twilio unavailable (%s); falling back to console", exc)
            return ConsoleSmsProvider()

    return ConsoleSmsProvider()


def normalize_phone(phone):
    digits = "".join(ch for ch in str(phone) if ch.isdigit() or ch == "+")
    return digits


def send_sms(to, message):
    provider = get_provider()
    normalized = normalize_phone(to)
    try:
        status = provider.send(normalized, message)
    except Exception as exc:
        log.warning("SMS send failed via %s: %s", provider.name, exc)
        status = "failed"
    return provider.name, status
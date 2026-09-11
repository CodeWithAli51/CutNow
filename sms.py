import json
import logging
import os
import re
import urllib.request
import urllib.error

from config import Config

log = logging.getLogger("cutnow.sms")


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


class AndroidSmsGatewayProvider(SmsProvider):
    """Send SMS through an Android phone running the open-source SMS Gateway app.

    Phone setup (5 minutes, one-time):
      1. Install "SMS Gateway" from F-Droid or Google Play on an Android
         phone that has an active SIM card.
      2. Open the app → tap "Start" → note the IP and port shown
         (e.g. http://192.168.1.50:8080).
      3. Put ANDROID_GATEWAY_URL in your .env:
         ANDROID_GATEWAY_URL=http://192.168.1.50:8080/v1/sms

    The phone must be on the same WiFi network as the server.
    """

    name = "android"

    def send(self, to, message):
        url = os.environ.get("ANDROID_GATEWAY_URL", "").rstrip("/")
        if not url:
            raise RuntimeError("ANDROID_GATEWAY_URL not set")

        digits = re.sub(r"\D", "", to)
        ten_digit = digits[-10:] if len(digits) >= 10 else digits
        phone = "+91" + ten_digit if len(ten_digit) == 10 and not ten_digit.startswith("+") else ten_digit

        payload = json.dumps({
            "phone": phone,
            "message": message,
        }).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            log.info("Android Gateway -> %s: HTTP %s", phone, resp.status)

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

    if provider == "android":
        url = os.environ.get("ANDROID_GATEWAY_URL", "")
        if not url:
            log.warning("ANDROID_GATEWAY_URL not set — falling back to console")
            return ConsoleSmsProvider()
        return AndroidSmsGatewayProvider()

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
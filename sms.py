import logging

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
    if provider == "twilio":
        try:
            return TwilioSmsProvider()
        except Exception as exc:
            log.warning("Twilio unavailable (%s); falling back to console provider", exc)
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
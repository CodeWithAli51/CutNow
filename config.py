import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-insecure-change-me")
    DATABASE_PATH = os.environ.get("DATABASE_PATH", os.path.join(BASE_DIR, "cutnow.db"))
    BASE_URL = os.environ.get("BASE_URL", "http://localhost:5000").rstrip("/")
    PORT = int(os.environ.get("PORT", "5000"))

    SMS_PROVIDER = os.environ.get("SMS_PROVIDER", "console").lower()
    TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER", "")

    REMINDER_ENABLED = os.environ.get("REMINDER_ENABLED", "true").lower() == "true"
    REMINDER_INTERVAL_SECONDS = int(os.environ.get("REMINDER_INTERVAL_SECONDS", "20"))
    REMINDER_NEAR_POSITION = int(os.environ.get("REMINDER_NEAR_POSITION", "3"))

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true"
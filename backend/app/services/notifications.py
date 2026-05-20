"""Twilio notification service for WhatsApp and SMS reminders."""

from app.config import settings


def send_whatsapp(to: str, message: str) -> bool:
    """Send a WhatsApp message via Twilio. Returns True on success."""
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        print(f"[Twilio MOCK] WhatsApp to {to}: {message}")
        return True
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            body=message,
            from_=settings.TWILIO_WHATSAPP_FROM,
            to=f"whatsapp:{to}",
        )
        return True
    except Exception as exc:
        print(f"[Twilio Error] {exc}")
        return False


def send_sms(to: str, message: str) -> bool:
    """Send an SMS via Twilio. Returns True on success."""
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        print(f"[Twilio MOCK] SMS to {to}: {message}")
        return True
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            body=message,
            from_=settings.TWILIO_FROM_NUMBER,
            to=to,
        )
        return True
    except Exception as exc:
        print(f"[Twilio Error] {exc}")
        return False

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

def send_recovery_email(to: str, recovery_code: str) -> bool:
    """Send a 2FA recovery code via Email. Returns True on success."""
    import smtplib
    from email.message import EmailMessage
    
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        print(f"[Email MOCK] Recovery code to {to}: {recovery_code}")
        return True
        
    try:
        msg = EmailMessage()
        msg.set_content(f"Tu código de recuperación para MotoStock es: {recovery_code}\n\nEste código es válido por 24 horas y de un solo uso.")
        msg['Subject'] = 'Código de Recuperación MotoStock'
        msg['From'] = settings.SMTP_USER
        msg['To'] = to

        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as exc:
        print(f"[Email Error] {exc}")
        return False

"""APScheduler job: daily oil-change reminder at 08:00."""

from datetime import date, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Client, Sale
from app.services.notifications import send_whatsapp
from app.scheduler.backup import setup_backup_job
from app.config import settings

scheduler = BackgroundScheduler()


def _send_oil_reminders():
    db: Session = SessionLocal()
    try:
        today = date.today()
        window_end = today + timedelta(days=7)
        clients: list[Client] = db.query(Client).all()

        for client in clients:
            if not client.last_service_date:
                continue

            # Estimate next service date at ~50 km/day average
            days_for_interval = client.oil_change_interval_km // 50
            next_service_date = client.last_service_date + timedelta(days=days_for_interval)

            if today <= next_service_date <= window_end:
                days_left = (next_service_date - today).days
                msg = (
                    f"🏍️ Hola {client.name}! Tu próximo cambio de aceite "
                    f"para {client.motorcycle_model} está programado en {days_left} día(s) "
                    f"(aprox. {next_service_date.isoformat()}). "
                    f"¡Contáctanos para agendar tu cita! — MotoStock"
                )
                send_whatsapp(client.phone, msg)
                print(f"[Scheduler] Reminder sent to {client.name} ({client.phone})")
    finally:
        db.close()


def _send_weekly_report():
    print("[Report MOCK] Generando reporte semanal de ventas e inventario...")
    if settings.REPORT_EMAIL and settings.REPORT_EMAIL != "dueno@correo.com":
        print(f"[Report Email MOCK] Enviando reporte semanal a {settings.REPORT_EMAIL}")


def start_scheduler():
    """Register and start the background scheduler."""
    scheduler.add_job(
        _send_oil_reminders,
        trigger="cron",
        hour=8,
        minute=0,
        id="oil_change_reminders",
        replace_existing=True,
    )
    
    scheduler.add_job(
        _send_weekly_report,
        trigger="cron",
        day_of_week="mon",
        hour=7,
        minute=0,
        id="weekly_report",
        replace_existing=True,
    )
    
    setup_backup_job(scheduler)
    
    scheduler.start()
    print("[Scheduler] Jobs started (Reminders 8:00, Weekly Report Mon 7:00, Backup Interval)")


def stop_scheduler():
    scheduler.shutdown(wait=False)

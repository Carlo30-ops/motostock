import json
import os
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Product, Client, Sale, PurchaseOrder, Combo
from app.config import settings
from app.schemas import ProductOut, ClientOut, SaleOut, PurchaseOrderOut, ComboOut
from app.logging_config import get_logger

BACKUP_DIR = Path(__file__).parent.parent.parent / "backups"
BACKUP_DIR.mkdir(exist_ok=True)
logger = get_logger("backups")


def cleanup_old_backups():
    """Removes backups older than BACKUP_RETENTION_DAYS."""
    cutoff = datetime.now() - timedelta(days=settings.BACKUP_RETENTION_DAYS)
    for f in BACKUP_DIR.glob("*.json"):
        if f.is_file():
            # filename format: YYYY-MM-DD_HH-MM.json
            try:
                date_str = f.stem
                f_date = datetime.strptime(date_str, "%Y-%m-%d_%H-%M")
                if f_date < cutoff:
                    f.unlink()
            except ValueError:
                pass


def send_backup_email(filepath: str, timestamp: str):
    """Sends the backup file via email if configured."""
    if not settings.BACKUP_EMAIL or settings.BACKUP_EMAIL == "dueno@correo.com":
        print("[Backup] No valid BACKUP_EMAIL configured. Skipping email.")
        return

    # In a real scenario, use SMTP credentials from settings.
    # For now, we mock the email sending.
    print(f"[Backup Email MOCK] Sending backup {filepath} to {settings.BACKUP_EMAIL}")
    
    # Real implementation would be:
    # msg = EmailMessage()
    # msg['Subject'] = f'MotoStock Backup - {timestamp}'
    # msg['From'] = "system@motostock.local"
    # msg['To'] = settings.BACKUP_EMAIL
    # msg.set_content("Adjunto se encuentra la copia de seguridad de la base de datos de MotoStock.")
    # with open(filepath, 'rb') as f:
    #     msg.add_attachment(f.read(), maintype='application', subtype='json', filename=os.path.basename(filepath))
    # with smtplib.SMTP('smtp.example.com') as s:
    #     s.send_message(msg)


def perform_backup():
    """Creates a JSON snapshot of the database."""
    print("[Backup] Starting automated backup...")
    db: Session = SessionLocal()
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
        filepath = BACKUP_DIR / f"{timestamp}.json"
        
        # We use schemas to easily serialize to dict
        data = {
            "timestamp": datetime.now().isoformat(),
            "products": [ProductOut.model_validate(p).model_dump(mode='json') for p in db.query(Product).all()],
            "clients": [ClientOut.model_validate(client).model_dump(mode='json') for client in db.query(Client).all()],
            "sales": [SaleOut.model_validate(s).model_dump(mode='json') for s in db.query(Sale).all()],
            "orders": [PurchaseOrderOut.model_validate(o).model_dump(mode='json') for o in db.query(PurchaseOrder).all()],
            "combos": [ComboOut.model_validate(c).model_dump(mode='json') for c in db.query(Combo).all()]
        }
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        print(f"[Backup] Snapshot saved to {filepath}")
        
        cleanup_old_backups()
        send_backup_email(str(filepath), timestamp)
        
    except Exception as e:
        logger.error(
            "Backup generation failed",
            error=str(e),
            error_type=type(e).__name__,
            exc_info=True,
        )
        raise
    finally:
        db.close()


def setup_backup_job(scheduler: BackgroundScheduler):
    """Registers the backup job to run every BACKUP_INTERVAL_HOURS."""
    scheduler.add_job(
        perform_backup,
        trigger="interval",
        hours=settings.BACKUP_INTERVAL_HOURS,
        id="automated_backup",
        replace_existing=True,
    )
    print(f"[Scheduler] Automated backup job started — runs every {settings.BACKUP_INTERVAL_HOURS} hours")

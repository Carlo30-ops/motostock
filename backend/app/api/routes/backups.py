from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.services.auth import require_minimum_role
from app.scheduler.backup import perform_backup

router = APIRouter(dependencies=[Depends(require_minimum_role("admin"))])

BACKUP_DIR = Path(__file__).parent.parent.parent.parent / "backups"

@router.get("/")
def list_backups():
    """Returns a list of available backups."""
    if not BACKUP_DIR.exists():
        return []
        
    backups = []
    for f in BACKUP_DIR.glob("*.json"):
        if f.is_file():
            stat = f.stat()
            backups.append({
                "filename": f.name,
                "size_bytes": stat.st_size,
                "created_at": stat.st_mtime
            })
            
    # Sort descending by creation
    backups.sort(key=lambda x: x["created_at"], reverse=True)
    return backups

@router.get("/{filename}/download")
def download_backup(filename: str):
    """Downloads a specific backup file."""
    safe_filename = Path(filename).name
    if safe_filename != filename or not safe_filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Invalid backup filename")

    filepath = (BACKUP_DIR / safe_filename).resolve()
    backup_root = BACKUP_DIR.resolve()
    if backup_root not in filepath.parents:
        raise HTTPException(status_code=400, detail="Invalid backup path")

    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="Backup file not found")
        
    return FileResponse(
        path=filepath, 
        filename=safe_filename, 
        media_type="application/json"
    )

@router.post("/trigger")
def trigger_backup():
    """Manually triggers the automated backup process and email delivery."""
    try:
        perform_backup()
        return {"status": "ok", "message": "Copia de seguridad generada y enviada correctamente."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

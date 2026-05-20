from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services.auth import require_minimum_role

router = APIRouter(dependencies=[Depends(require_minimum_role("cashier"))])


def _to_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _parse_model_timestamp(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return _to_aware(value)


@router.post("/", response_model=schemas.SyncReportOut)
def sync_batch(payload: schemas.SyncBatchIn, db: Session = Depends(get_db)):
    operations = sorted(payload.operations, key=lambda op: _to_aware(op.timestamp))
    success_count = 0
    failed_count = 0
    conflicts: list[schemas.SyncConflict] = []

    for operation in operations:
        resource = operation.resource.lower()
        action = operation.action.lower()
        op_ts = _to_aware(operation.timestamp)

        try:
            if resource == "products":
                model_cls = models.Product
                ts_field = "updated_at"
            elif resource == "clients":
                model_cls = models.Client
                ts_field = "updated_at"
            elif resource == "sales":
                model_cls = models.Sale
                ts_field = "created_at"
            elif resource == "orders":
                model_cls = models.PurchaseOrder
                ts_field = "created_at"
            else:
                failed_count += 1
                conflicts.append(
                    schemas.SyncConflict(
                        resource=resource,
                        record_id=operation.record_id,
                        reason="Unsupported resource",
                        operation_timestamp=operation.timestamp,
                    )
                )
                continue

            db_record = None
            if operation.record_id:
                db_record = db.query(model_cls).filter(model_cls.id == operation.record_id).first()

            if action == "create":
                if db_record:
                    existing_ts = _parse_model_timestamp(getattr(db_record, ts_field, None))
                    if existing_ts and existing_ts > op_ts:
                        conflicts.append(
                            schemas.SyncConflict(
                                resource=resource,
                                record_id=operation.record_id,
                                reason="Conflict: newer record already exists",
                                operation_timestamp=operation.timestamp,
                            )
                        )
                        failed_count += 1
                        continue
                created = model_cls(**operation.payload)
                db.add(created)
                db.flush()
                success_count += 1
                continue

            if action == "update":
                if not db_record:
                    failed_count += 1
                    conflicts.append(
                        schemas.SyncConflict(
                            resource=resource,
                            record_id=operation.record_id,
                            reason="Record not found for update",
                            operation_timestamp=operation.timestamp,
                        )
                    )
                    continue
                existing_ts = _parse_model_timestamp(getattr(db_record, ts_field, None))
                if existing_ts and existing_ts > op_ts:
                    conflicts.append(
                        schemas.SyncConflict(
                            resource=resource,
                            record_id=operation.record_id,
                            reason="Conflict: last-write-wins, server record is newer",
                            operation_timestamp=operation.timestamp,
                        )
                    )
                    failed_count += 1
                    continue
                for key, value in operation.payload.items():
                    if hasattr(db_record, key):
                        setattr(db_record, key, value)
                success_count += 1
                continue

            failed_count += 1
            conflicts.append(
                schemas.SyncConflict(
                    resource=resource,
                    record_id=operation.record_id,
                    reason="Unsupported action",
                    operation_timestamp=operation.timestamp,
                )
            )
        except Exception as exc:
            failed_count += 1
            conflicts.append(
                schemas.SyncConflict(
                    resource=resource,
                    record_id=operation.record_id,
                    reason=f"Processing error: {exc}",
                    operation_timestamp=operation.timestamp,
                )
            )

    db.commit()
    return schemas.SyncReportOut(
        success_count=success_count,
        failed_count=failed_count,
        conflict_count=len(conflicts),
        conflicts=conflicts,
    )

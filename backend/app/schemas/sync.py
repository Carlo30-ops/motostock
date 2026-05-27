from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class SyncOperation(BaseModel):
    resource: str
    action: str
    record_id: Optional[int] = None
    timestamp: datetime
    payload: dict


class SyncConflict(BaseModel):
    resource: str
    record_id: Optional[int] = None
    reason: str
    operation_timestamp: datetime


class SyncBatchIn(BaseModel):
    operations: list[SyncOperation]


class SyncReportOut(BaseModel):
    success_count: int
    failed_count: int
    conflict_count: int
    conflicts: list[SyncConflict]

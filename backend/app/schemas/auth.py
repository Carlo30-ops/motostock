from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    refresh_token: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenData(BaseModel):
    username: Optional[str] = None


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "cashier"
    branch_id: Optional[int] = None
    max_discount: float = 0.0


class UserUpdate(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    branch_id: Optional[int] = None
    is_active: Optional[bool] = None
    max_discount: Optional[float] = None


class PasswordChange(BaseModel):
    current_password: Optional[str] = None
    new_password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    role: str
    branch_id: int
    max_discount: float
    is_active: bool
    created_at: datetime


class PinLogin(BaseModel):
    pin: str

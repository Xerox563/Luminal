from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class APIKeyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class APIKeyCreate(APIKeyBase):
    pass


class APIKeyResponse(APIKeyBase):
    id: int
    key: str
    is_active: bool
    created_at: datetime
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class APIKeyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    is_active: Optional[bool] = None
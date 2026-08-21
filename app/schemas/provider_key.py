from pydantic import BaseModel, Field
from typing import Optional, List
from app.models import ProviderName


class ProviderKeyCreate(BaseModel):
    provider: ProviderName
    api_key: str = Field(..., min_length=1)
    base_url: Optional[str] = None


class ProviderKeyUpdate(BaseModel):
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    is_active: Optional[bool] = None


class ProviderKeyResponse(BaseModel):
    id: int
    provider: ProviderName
    base_url: Optional[str] = None
    is_active: bool
    created_at: str
    updated_at: str
    has_key: bool = True
    
    class Config:
        from_attributes = True


class ProviderKeyListResponse(BaseModel):
    keys: List[ProviderKeyResponse]


class ProviderKeyTestRequest(BaseModel):
    provider: ProviderName
    api_key: str
    base_url: Optional[str] = None


class ProviderKeyTestResponse(BaseModel):
    success: bool
    message: str
    model: Optional[str] = None
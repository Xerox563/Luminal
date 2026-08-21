from pydantic import BaseModel, Field
from typing import Optional, List
from app.models import ComplexityLevel


class ModelConfigCreate(BaseModel):
    complexity: ComplexityLevel
    model_name: str = Field(..., min_length=1)
    provider: str = "openrouter"
    max_tokens: int = 4096
    temperature: float = 0.7
    is_default: bool = False


class ModelConfigUpdate(BaseModel):
    model_name: Optional[str] = None
    provider: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    is_default: Optional[bool] = None


class ModelConfigResponse(BaseModel):
    id: int
    complexity: ComplexityLevel
    model_name: str
    provider: str
    max_tokens: int
    temperature: float
    is_default: bool
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class ModelConfigListResponse(BaseModel):
    configs: List[ModelConfigResponse]
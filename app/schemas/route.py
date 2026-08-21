from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class RouteRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    api_key: Optional[str] = Field(default="", description="Optional API key (dashboard uses JWT bearer token instead)")


class RouteResponse(BaseModel):
    content: str
    model: str
    complexity: str
    tokens_used: int
    cost: float
    latency_ms: int
    session_id: str


class LogResponse(BaseModel):
    id: int
    prompt: str
    model_used: str
    complexity: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost: float
    latency_ms: int
    quality_score: Optional[float] = None
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
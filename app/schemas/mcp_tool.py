from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class MCPToolCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    endpoint_url: str = Field(..., min_length=1)
    auth_type: str = Field(default="none")  # none, api_key, bearer, basic
    auth_config: Optional[Dict[str, Any]] = None
    trigger_keywords: Optional[List[str]] = None
    parameters_schema: Optional[Dict[str, Any]] = None
    requires_approval: bool = False


class MCPToolUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    endpoint_url: Optional[str] = None
    auth_type: Optional[str] = None
    auth_config: Optional[Dict[str, Any]] = None
    trigger_keywords: Optional[List[str]] = None
    parameters_schema: Optional[Dict[str, Any]] = None
    requires_approval: Optional[bool] = None
    is_active: Optional[bool] = None


class MCPToolResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    endpoint_url: str
    auth_type: str
    auth_config: Optional[Dict[str, Any]]
    trigger_keywords: Optional[List[str]]
    parameters_schema: Optional[Dict[str, Any]]
    requires_approval: bool
    is_active: bool
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class MCPToolListResponse(BaseModel):
    tools: List[MCPToolResponse]


class MCPToolExecuteRequest(BaseModel):
    name: str
    arguments: Dict[str, Any] = {}


class MCPToolExecuteResponse(BaseModel):
    name: str
    result: Any
    success: bool
    error: Optional[str] = None


class MCPToolTestRequest(BaseModel):
    name: str
    endpoint_url: str
    auth_type: str = "none"
    auth_config: Optional[Dict[str, Any]] = None
    parameters_schema: Optional[Dict[str, Any]] = None
    arguments: Dict[str, Any] = {}


class MCPToolTestResponse(BaseModel):
    success: bool
    message: str
    result: Optional[Any] = None
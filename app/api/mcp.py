from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from app.db.session import get_db
from app.services.auth import get_current_user
from app.services.mcp import get_mcp_client, default_mcp_server
from app.models import User

router = APIRouter(prefix="/mcp", tags=["mcp"])


class ToolExecuteRequest(BaseModel):
    name: str
    arguments: Dict[str, Any] = {}


class ToolExecuteResponse(BaseModel):
    name: str
    result: Any
    success: bool
    error: Optional[str] = None


class ToolInfo(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any]
    requires_approval: bool


@router.get("/tools", response_model=List[ToolInfo])
async def list_tools(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    client = get_mcp_client()
    tools = client.list_tools()
    return [ToolInfo(**tool) for tool in tools]


@router.post("/tools/execute", response_model=ToolExecuteResponse)
async def execute_tool(
    request: ToolExecuteRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    client = get_mcp_client()
    
    try:
        result = await client.execute_tool(request.name, request.arguments)
        return ToolExecuteResponse(name=request.name, result=result, success=True)
    except Exception as e:
        return ToolExecuteResponse(name=request.name, result=None, success=False, error=str(e))


@router.get("/tools/{tool_name}", response_model=ToolInfo)
async def get_tool(
    tool_name: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    tool = default_mcp_server.get_tool(tool_name)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return ToolInfo(
        name=tool.name,
        description=tool.description,
        parameters=tool.parameters,
        requires_approval=tool.requires_approval
    )
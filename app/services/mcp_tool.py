import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import MCPToolConfig, User
from typing import Optional, List, Dict, Any


async def create_mcp_tool(
    db: AsyncSession,
    user_id: int,
    name: str,
    endpoint_url: str,
    description: Optional[str] = None,
    auth_type: str = "none",
    auth_config: Optional[Dict[str, Any]] = None,
    trigger_keywords: Optional[List[str]] = None,
    parameters_schema: Optional[Dict[str, Any]] = None,
    requires_approval: bool = False
) -> MCPToolConfig:
    tool = MCPToolConfig(
        user_id=user_id,
        name=name,
        description=description,
        endpoint_url=endpoint_url,
        auth_type=auth_type,
        auth_config=auth_config,
        trigger_keywords=trigger_keywords,
        parameters_schema=parameters_schema,
        requires_approval=requires_approval,
        is_active=True
    )
    db.add(tool)
    await db.commit()
    await db.refresh(tool)
    return tool


async def get_mcp_tool(db: AsyncSession, user_id: int, tool_id: int) -> Optional[MCPToolConfig]:
    result = await db.execute(
        select(MCPToolConfig).where(
            MCPToolConfig.id == tool_id,
            MCPToolConfig.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def get_mcp_tool_by_name(db: AsyncSession, user_id: int, name: str) -> Optional[MCPToolConfig]:
    result = await db.execute(
        select(MCPToolConfig).where(
            MCPToolConfig.user_id == user_id,
            MCPToolConfig.name == name,
            MCPToolConfig.is_active == True
        )
    )
    return result.scalar_one_or_none()


async def get_all_mcp_tools(db: AsyncSession, user_id: int) -> List[MCPToolConfig]:
    result = await db.execute(
        select(MCPToolConfig).where(
            MCPToolConfig.user_id == user_id
        ).order_by(MCPToolConfig.created_at.desc())
    )
    return result.scalars().all()


async def get_active_mcp_tools(db: AsyncSession, user_id: int) -> List[MCPToolConfig]:
    result = await db.execute(
        select(MCPToolConfig).where(
            MCPToolConfig.user_id == user_id,
            MCPToolConfig.is_active == True
        )
    )
    return result.scalars().all()


async def update_mcp_tool(db: AsyncSession, tool: MCPToolConfig, data: Dict[str, Any]) -> MCPToolConfig:
    for key, value in data.items():
        if value is not None and hasattr(tool, key):
            setattr(tool, key, value)
    tool.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(tool)
    return tool


async def delete_mcp_tool(db: AsyncSession, tool: MCPToolConfig) -> None:
    await db.delete(tool)
    await db.commit()


async def execute_mcp_tool(
    tool: MCPToolConfig,
    arguments: Dict[str, Any]
) -> Dict[str, Any]:
    headers = {"Content-Type": "application/json"}
    
    if tool.auth_type == "api_key" and tool.auth_config:
        api_key = tool.auth_config.get("api_key")
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
    elif tool.auth_type == "bearer" and tool.auth_config:
        token = tool.auth_config.get("token")
        if token:
            headers["Authorization"] = f"Bearer {token}"
    elif tool.auth_type == "basic" and tool.auth_config:
        username = tool.auth_config.get("username")
        password = tool.auth_config.get("password")
        if username and password:
            import base64
            credentials = base64.b64encode(f"{username}:{password}".encode()).decode()
            headers["Authorization"] = f"Basic {credentials}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            tool.endpoint_url,
            headers=headers,
            json=arguments
        )
        response.raise_for_status()
        return response.json()


async def find_matching_tool(db: AsyncSession, user_id: int, prompt: str) -> Optional[MCPToolConfig]:
    tools = await get_active_mcp_tools(db, user_id)
    
    prompt_lower = prompt.lower()
    best_match = None
    best_score = 0
    
    for tool in tools:
        if tool.trigger_keywords:
            score = sum(1 for kw in tool.trigger_keywords if kw.lower() in prompt_lower)
            if score > best_score:
                best_score = score
                best_match = tool
    
    if best_score >= 1:
        return best_match
    return None


from datetime import datetime
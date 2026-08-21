from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.mcp_tool import execute_mcp_tool, get_mcp_tool_by_name
from app.services.tool_calling import decide_tool_call, decide_tool_call_llm, ToolCallDecision
from app.core.config import settings


@dataclass
class ToolExecutionResult:
    tool_name: str
    success: bool
    result: Any
    error: Optional[str] = None
    arguments: Dict[str, Any] = None


async def execute_tool_call(db: AsyncSession, user_id: int, decision: ToolCallDecision) -> ToolExecutionResult:
    if not decision.should_call or not decision.tool_name:
        return ToolExecutionResult(
            tool_name="none",
            success=False,
            result=None,
            error="No tool to call",
            arguments=decision.arguments
        )
    
    # Get the user's registered tool
    tool = await get_mcp_tool_by_name(db, user_id, decision.tool_name)
    
    if not tool:
        return ToolExecutionResult(
            tool_name=decision.tool_name,
            success=False,
            result=None,
            error=f"Tool '{decision.tool_name}' not found or not active",
            arguments=decision.arguments
        )
    
    try:
        result = await execute_mcp_tool(tool, decision.arguments)
        return ToolExecutionResult(
            tool_name=decision.tool_name,
            success=True,
            result=result,
            arguments=decision.arguments
        )
    except Exception as e:
        return ToolExecutionResult(
            tool_name=decision.tool_name,
            success=False,
            result=None,
            error=str(e),
            arguments=decision.arguments
        )


async def process_tool_calls(db: AsyncSession, user_id: int, prompt: str, use_llm: bool = False) -> List[ToolExecutionResult]:
    if use_llm and settings.use_llm_complexity:
        decision = await decide_tool_call_llm(db, user_id, prompt)
    else:
        decision = await decide_tool_call(db, user_id, prompt)
    
    if not decision.should_call:
        return []
    
    result = await execute_tool_call(db, user_id, decision)
    return [result]


def format_tool_results(results: List[ToolExecutionResult]) -> str:
    if not results:
        return ""
    
    parts = ["\nTool Results:"]
    for r in results:
        if r.success:
            parts.append(f"\n[{r.tool_name}] Result: {r.result}")
        else:
            parts.append(f"\n[{r.tool_name}] Error: {r.error}")
    return "\n".join(parts)
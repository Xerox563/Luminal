from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from app.services.mcp import get_mcp_client
from app.services.tool_calling import decide_tool_call, decide_tool_call_llm, ToolCallDecision
from app.core.config import settings


@dataclass
class ToolExecutionResult:
    tool_name: str
    success: bool
    result: Any
    error: Optional[str] = None
    arguments: Dict[str, Any] = None


async def execute_tool_call(decision: ToolCallDecision) -> ToolExecutionResult:
    if not decision.should_call or not decision.tool_name:
        return ToolExecutionResult(
            tool_name="none",
            success=False,
            result=None,
            error="No tool to call",
            arguments=decision.arguments
        )
    
    client = get_mcp_client()
    
    try:
        result = await client.execute_tool(decision.tool_name, decision.arguments)
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


async def process_tool_calls(prompt: str, use_llm: bool = False) -> List[ToolExecutionResult]:
    if use_llm and settings.use_llm_complexity:
        decision = await decide_tool_call_llm(prompt)
    else:
        decision = await decide_tool_call(prompt)
    
    if not decision.should_call:
        return []
    
    result = await execute_tool_call(decision)
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
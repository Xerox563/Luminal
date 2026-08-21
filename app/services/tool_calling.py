from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.mcp_tool import get_active_mcp_tools
from app.services.providers import ProviderRegistry
from app.core.config import settings


@dataclass
class ToolCallDecision:
    should_call: bool
    tool_name: Optional[str]
    arguments: Dict[str, Any]
    confidence: float
    reasoning: str


async def decide_tool_call(db: AsyncSession, user_id: int, prompt: str) -> ToolCallDecision:
    prompt_lower = prompt.lower()
    
    # Get user's registered MCP tools
    tools = await get_active_mcp_tools(db, user_id)
    
    if not tools:
        return ToolCallDecision(
            should_call=False,
            tool_name=None,
            arguments={},
            confidence=0.0,
            reasoning="No tools registered"
        )
    
    tool_scores = {}
    for tool in tools:
        if tool.trigger_keywords:
            score = sum(1 for kw in tool.trigger_keywords if kw.lower() in prompt_lower)
            if score > 0:
                tool_scores[tool.name] = (score, tool)
    
    if not tool_scores:
        return ToolCallDecision(
            should_call=False,
            tool_name=None,
            arguments={},
            confidence=0.0,
            reasoning="No tool keywords detected"
        )
    
    best_tool_name = max(tool_scores, key=lambda x: tool_scores[x][0])
    max_score, best_tool = tool_scores[best_tool_name]
    
    if max_score >= 2:
        confidence = min(0.9, max_score * 0.3)
    elif max_score == 1:
        confidence = 0.5
    else:
        confidence = 0.0
    
    arguments = extract_arguments(prompt, best_tool)
    
    return ToolCallDecision(
        should_call=confidence >= 0.5,
        tool_name=best_tool_name if confidence >= 0.5 else None,
        arguments=arguments,
        confidence=confidence,
        reasoning=f"Detected {best_tool_name} keywords: {best_tool.trigger_keywords}"
    )


def extract_arguments(prompt: str, tool) -> Dict[str, Any]:
    import re
    
    # If tool has parameters schema, use it to extract arguments
    if tool.parameters_schema:
        # Simple extraction based on schema properties
        properties = tool.parameters_schema.get("properties", {})
        arguments = {}
        for param_name, param_info in properties.items():
            param_type = param_info.get("type", "string")
            # Try to find the value in the prompt
            # This is a simple implementation - can be enhanced
            if param_type == "string":
                # Look for patterns like "param_name value" or "param_name: value"
                patterns = [
                    rf'{param_name}["\']?\s*[:=]\s*["\']?([^"\',\s]+)',
                    rf'{param_name}\s+([^"\',\s]+)'
                ]
                for pattern in patterns:
                    match = re.search(pattern, prompt, re.IGNORECASE)
                    if match:
                        arguments[param_name] = match.group(1)
                        break
        if arguments:
            return arguments
    
    # Fallback to simple extraction for common tool types
    tool_name = tool.name.lower()
    
    if "weather" in tool_name:
        city_match = re.search(r'(?:weather|temperature|forecast)\s+(?:in|for|at)\s+([a-zA-Z\s]+)', prompt, re.IGNORECASE)
        if city_match:
            return {"city": city_match.group(1).strip()}
        city_match = re.search(r'(?:in|for|at)\s+([a-zA-Z\s]+?)(?:\?|$)', prompt, re.IGNORECASE)
        if city_match:
            return {"city": city_match.group(1).strip()}
        return {"city": "unknown"}
    
    elif "search" in tool_name:
        query_match = re.search(r'(?:search|find|look up)\s+(?:for\s+)?(.+)', prompt, re.IGNORECASE)
        if query_match:
            return {"query": query_match.group(1).strip()}
        return {"query": prompt}
    
    elif "calculate" in tool_name or "math" in tool_name:
        expr_match = re.search(r'(?:calculate|compute)\s+(.+)', prompt, re.IGNORECASE)
        if expr_match:
            return {"expression": expr_match.group(1).strip()}
        math_expr = re.search(r'[\d\+\-\*\/\.\s\(\)]+', prompt)
        if math_expr:
            return {"expression": math_expr.group(0).strip()}
        return {"expression": prompt}
    
    # Generic extraction for unknown tools
    return {"query": prompt}


async def decide_tool_call_llm(db: AsyncSession, user_id: int, prompt: str) -> ToolCallDecision:
    tools = await get_active_mcp_tools(db, user_id)
    
    if not tools:
        return ToolCallDecision(
            should_call=False,
            tool_name=None,
            arguments={},
            confidence=0.0,
            reasoning="No tools available"
        )
    
    provider = ProviderRegistry.get("openrouter") or ProviderRegistry.get("openai")
    if not provider:
        return await decide_tool_call(db, user_id, prompt)
    
    tool_descriptions = "\n".join([
        f"- {t.name}: {t.description} (params: {t.parameters_schema})"
        for t in tools
    ])
    
    system_prompt = f"""You are a tool-calling assistant. Given a user prompt, decide if a tool should be called.

Available tools:
{tool_descriptions}

Respond with JSON only:
{{
  "should_call": true/false,
  "tool_name": "tool_name or null",
  "arguments": {{}},
  "confidence": 0.0-1.0,
  "reasoning": "explanation"
}}"""
    
    try:
        result = await provider.chat_completion(
            model="anthropic/claude-3-haiku",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            max_tokens=200,
            temperature=0
        )
        
        import json
        decision_data = json.loads(result["content"])
        return ToolCallDecision(**decision_data)
    except Exception:
        return await decide_tool_call(db, user_id, prompt)
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from app.services.mcp import get_mcp_client
from app.services.providers import ProviderRegistry
from app.core.config import settings


TOOL_KEYWORDS = {
    "get_weather": ["weather", "temperature", "forecast", "rain", "sunny", "cloudy", "humidity", "wind"],
    "search_web": ["search", "find", "look up", "google", "latest", "recent", "news", "current"],
    "calculate": ["calculate", "compute", "math", "equation", "formula", "solve", "arithmetic"]
}


@dataclass
class ToolCallDecision:
    should_call: bool
    tool_name: Optional[str]
    arguments: Dict[str, Any]
    confidence: float
    reasoning: str


async def decide_tool_call(prompt: str) -> ToolCallDecision:
    prompt_lower = prompt.lower()
    
    tool_scores = {}
    for tool_name, keywords in TOOL_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in prompt_lower)
        if score > 0:
            tool_scores[tool_name] = score
    
    if not tool_scores:
        return ToolCallDecision(
            should_call=False,
            tool_name=None,
            arguments={},
            confidence=0.0,
            reasoning="No tool keywords detected"
        )
    
    best_tool = max(tool_scores, key=tool_scores.get)
    max_score = tool_scores[best_tool]
    
    if max_score >= 2:
        confidence = min(0.9, max_score * 0.3)
    elif max_score == 1:
        confidence = 0.5
    else:
        confidence = 0.0
    
    arguments = extract_arguments(prompt, best_tool)
    
    return ToolCallDecision(
        should_call=confidence >= 0.5,
        tool_name=best_tool if confidence >= 0.5 else None,
        arguments=arguments,
        confidence=confidence,
        reasoning=f"Detected {best_tool} keywords: {TOOL_KEYWORDS[best_tool]}"
    )


def extract_arguments(prompt: str, tool_name: str) -> Dict[str, Any]:
    import re
    
    if tool_name == "get_weather":
        city_match = re.search(r'(?:weather|temperature|forecast)\s+(?:in|for|at)\s+([a-zA-Z\s]+)', prompt, re.IGNORECASE)
        if city_match:
            return {"city": city_match.group(1).strip()}
        city_match = re.search(r'(?:in|for|at)\s+([a-zA-Z\s]+?)(?:\?|$)', prompt, re.IGNORECASE)
        if city_match:
            return {"city": city_match.group(1).strip()}
        return {"city": "unknown"}
    
    elif tool_name == "search_web":
        query_match = re.search(r'(?:search|find|look up)\s+(?:for\s+)?(.+)', prompt, re.IGNORECASE)
        if query_match:
            return {"query": query_match.group(1).strip()}
        return {"query": prompt}
    
    elif tool_name == "calculate":
        expr_match = re.search(r'(?:calculate|compute)\s+(.+)', prompt, re.IGNORECASE)
        if expr_match:
            return {"expression": expr_match.group(1).strip()}
        math_expr = re.search(r'[\d\+\-\*\/\.\s\(\)]+', prompt)
        if math_expr:
            return {"expression": math_expr.group(0).strip()}
        return {"expression": prompt}
    
    return {}


async def decide_tool_call_llm(prompt: str) -> ToolCallDecision:
    client = get_mcp_client()
    tools = client.list_tools()
    
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
        return decide_tool_call(prompt)
    
    tool_descriptions = "\n".join([
        f"- {t['name']}: {t['description']} (params: {t['parameters']})"
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
        return decide_tool_call(prompt)
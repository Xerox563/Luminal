from typing import Dict, Any, Callable, List, Optional
from dataclasses import dataclass, field
import json
import inspect
import httpx


@dataclass
class MCPTool:
    name: str
    description: str
    parameters: Dict[str, Any]
    handler: Callable
    requires_approval: bool = False


@dataclass
class MCPServer:
    name: str
    tools: Dict[str, MCPTool] = field(default_factory=dict)
    
    def register_tool(self, tool: MCPTool) -> None:
        self.tools[tool.name] = tool
    
    def unregister_tool(self, name: str) -> bool:
        if name in self.tools:
            del self.tools[name]
            return True
        return False
    
    def get_tool(self, name: str) -> Optional[MCPTool]:
        return self.tools.get(name)
    
    def list_tools(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.parameters,
                "requires_approval": tool.requires_approval
            }
            for tool in self.tools.values()
        ]
    
    async def execute_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
        tool = self.get_tool(name)
        if not tool:
            raise ValueError(f"Tool '{name}' not found")
        
        if tool.requires_approval:
            raise ValueError(f"Tool '{name}' requires approval")
        
        return await tool.handler(**arguments)


def create_tool_schema(func: Callable) -> Dict[str, Any]:
    sig = inspect.signature(func)
    properties = {}
    required = []
    
    for param_name, param in sig.parameters.items():
        if param_name == "self":
            continue
        param_type = param.annotation if param.annotation != inspect.Parameter.empty else str
        properties[param_name] = {"type": get_json_type(param_type)}
        if param.default == inspect.Parameter.empty:
            required.append(param_name)
    
    return {
        "type": "object",
        "properties": properties,
        "required": required
    }


def get_json_type(python_type: type) -> str:
    type_map = {
        str: "string",
        int: "integer",
        float: "number",
        bool: "boolean",
        list: "array",
        dict: "object"
    }
    return type_map.get(python_type, "string")


class MCPClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def list_tools(self) -> List[Dict[str, Any]]:
        response = await self.client.get(f"{self.base_url}/tools")
        response.raise_for_status()
        return response.json()
    
    async def execute_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
        response = await self.client.post(
            f"{self.base_url}/tools/{name}/execute",
            json=arguments
        )
        response.raise_for_status()
        return response.json()
    
    async def close(self):
        await self.client.aclose()


default_mcp_server = MCPServer("luminal-tools")


def register_default_tools():
    async def get_weather(city: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"https://wttr.in/{city}?format=j1")
            response.raise_for_status()
            data = response.json()
            current = data.get("current_condition", [{}])[0]
            return {
                "city": city,
                "temperature": current.get("temp_C"),
                "condition": current.get("weatherDesc", [{}])[0].get("value"),
                "humidity": current.get("humidity"),
                "wind_speed": current.get("windspeedKmph")
            }
    
    async def search_web(query: str) -> Dict[str, Any]:
        return {"query": query, "results": ["Result 1", "Result 2", "Result 3"]}
    
    async def calculate(expression: str) -> Dict[str, Any]:
        try:
            result = eval(expression, {"__builtins__": {}}, {})
            return {"expression": expression, "result": result}
        except Exception as e:
            return {"expression": expression, "error": str(e)}
    
    default_mcp_server.register_tool(MCPTool(
        name="get_weather",
        description="Get current weather for a city",
        parameters=create_tool_schema(get_weather),
        handler=get_weather
    ))
    
    default_mcp_server.register_tool(MCPTool(
        name="search_web",
        description="Search the web for information",
        parameters=create_tool_schema(search_web),
        handler=search_web
    ))
    
    default_mcp_server.register_tool(MCPTool(
        name="calculate",
        description="Evaluate a mathematical expression",
        parameters=create_tool_schema(calculate),
        handler=calculate
    ))


def init_mcp():
    register_default_tools()
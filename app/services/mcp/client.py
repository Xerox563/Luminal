from typing import Dict, Any, List, Optional
import httpx
from app.services.mcp.server import default_mcp_server, MCPServer, MCPTool


class LocalMCPClient:
    def __init__(self, server: MCPServer = None):
        self.server = server or default_mcp_server
    
    def list_tools(self) -> List[Dict[str, Any]]:
        return self.server.list_tools()
    
    async def execute_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
        return await self.server.execute_tool(name, arguments)
    
    def get_tool(self, name: str) -> Optional[MCPTool]:
        return self.server.get_tool(name)


class RemoteMCPClient:
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


def get_mcp_client() -> LocalMCPClient:
    return LocalMCPClient()
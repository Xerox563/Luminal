from app.services.mcp.server import init_mcp, default_mcp_server, MCPServer, MCPTool
from app.services.mcp.client import LocalMCPClient, RemoteMCPClient, get_mcp_client


def init_mcp_services():
    init_mcp()
from typing import List, Optional, Dict, Any, Literal
from dataclasses import dataclass, field
from datetime import datetime
from pydantic import BaseModel
from app.models import ComplexityLevel
from app.services.vector_store.base import DocumentChunk
from app.services.mcp.server import MCPTool


class Message(BaseModel):
    role: Literal["user", "assistant", "system", "tool"]
    content: str
    tool_calls: Optional[List[Dict]] = None
    tool_call_id: Optional[str] = None


@dataclass
class AgentState:
    session_id: str
    user_id: int
    messages: List[Message] = field(default_factory=list)
    current_prompt: str = ""
    
    complexity: Optional[ComplexityLevel] = None
    retrieved_chunks: List[DocumentChunk] = field(default_factory=list)
    citations: List[Dict] = field(default_factory=list)
    used_rag: bool = False
    
    tool_calls: List[Dict] = field(default_factory=list)
    tool_results: List[Dict] = field(default_factory=list)
    tools_used: List[str] = field(default_factory=list)
    
    selected_model: Optional[str] = None
    selected_provider: Optional[str] = None
    model_config: Optional[Dict] = None
    
    response: str = ""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    tokens_used: int = 0
    cost: float = 0.0
    latency_ms: int = 0
    quality_score: Optional[float] = None
    critic_feedback: Optional[str] = None
    should_regenerate: bool = False
    regeneration_count: int = 0
    max_regenerations: int = 2
    
    pending_approval: Optional[Dict] = None
    approval_required: bool = False
    approval_granted: Optional[bool] = None
    
    error: Optional[str] = None
    error_count: int = 0
    max_errors: int = 3
    
    trace: List[Dict] = field(default_factory=list)
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_trace(self, node: str, action: str, data: Dict = None):
        self.trace.append({
            "node": node,
            "action": action,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data or {}
        })
    
    def to_dict(self) -> Dict:
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "messages": [m.model_dump() for m in self.messages],
            "current_prompt": self.current_prompt,
            "complexity": self.complexity.value if self.complexity else None,
            "retrieved_chunks": len(self.retrieved_chunks),
            "citations": self.citations,
            "used_rag": self.used_rag,
            "tool_calls": self.tool_calls,
            "tool_results": self.tool_results,
            "tools_used": self.tools_used,
            "selected_model": self.selected_model,
            "selected_provider": self.selected_provider,
            "response": self.response,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "tokens_used": self.tokens_used,
            "cost": self.cost,
            "latency_ms": self.latency_ms,
            "quality_score": self.quality_score,
            "critic_feedback": self.critic_feedback,
            "should_regenerate": self.should_regenerate,
            "regeneration_count": self.regeneration_count,
            "pending_approval": self.pending_approval,
            "approval_required": self.approval_required,
            "approval_granted": self.approval_granted,
            "error": self.error,
            "trace": self.trace,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "metadata": self.metadata
        }
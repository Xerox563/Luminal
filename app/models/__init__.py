import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text, Numeric, Boolean, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base


class ComplexityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ProviderName(str, enum.Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    DEEPSEEK = "deepseek"
    NVIDIA = "nvidia"
    OPENROUTER = "openrouter"
    OLLAMA = "ollama"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    monthly_budget = Column(Numeric(10, 2), default=0)
    current_spend = Column(Numeric(10, 2), default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    model_configs = relationship("ModelConfig", back_populates="user", cascade="all, delete-orphan")
    execution_logs = relationship("ExecutionLog", back_populates="user", cascade="all, delete-orphan")
    provider_keys = relationship("ProviderKey", back_populates="user", cascade="all, delete-orphan")
    mcp_tools = relationship("MCPToolConfig", back_populates="user", cascade="all, delete-orphan")


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    key_hash = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="api_keys")


class ProviderKey(Base):
    __tablename__ = "provider_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    provider = Column(Enum(ProviderName), nullable=False)
    encrypted_key = Column(Text, nullable=False)
    base_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="provider_keys")


class ModelConfig(Base):
    __tablename__ = "model_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    complexity = Column(Enum(ComplexityLevel), nullable=False)
    model_name = Column(String(100), nullable=False)
    provider = Column(String(50), default="openrouter")
    max_tokens = Column(Integer, default=4096)
    temperature = Column(Numeric(3, 2), default=0.7)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="model_configs")


class ExecutionLog(Base):
    __tablename__ = "execution_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"), nullable=True)
    prompt = Column(Text, nullable=False)
    model_used = Column(String(100), nullable=False)
    provider = Column(String(50), default="openrouter")
    complexity = Column(Enum(ComplexityLevel), nullable=True)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    cost = Column(Numeric(10, 6), default=0)
    latency_ms = Column(Integer, default=0)
    quality_score = Column(Numeric(3, 2), nullable=True)
    error_message = Column(Text, nullable=True)
    # none_as_null=True: without it, SQLAlchemy stores an unset Python None as
    # the JSON text "null" instead of SQL NULL, so "IS NOT NULL" filters (used
    # by /dashboard/rag-stats to detect RAG/tool usage) match every row.
    retrieval_metadata = Column(JSON(none_as_null=True), nullable=True)
    tool_metadata = Column(JSON(none_as_null=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="execution_logs")


class MCPToolConfig(Base):
    __tablename__ = "mcp_tool_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    endpoint_url = Column(String(500), nullable=False)
    auth_type = Column(String(50), default="none")
    auth_config = Column(JSON, nullable=True)
    trigger_keywords = Column(JSON, nullable=True)
    parameters_schema = Column(JSON, nullable=True)
    requires_approval = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="mcp_tools")


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True, index=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
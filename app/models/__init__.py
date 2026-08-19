import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text, Numeric, Boolean, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base


class ComplexityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


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
    retrieval_metadata = Column(JSON, nullable=True)
    tool_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="execution_logs")
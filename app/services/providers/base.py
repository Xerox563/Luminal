from abc import ABC, abstractmethod
from typing import Optional
from app.models import ComplexityLevel


class LLMProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @property
    @abstractmethod
    def supported_models(self) -> list[str]:
        pass

    @abstractmethod
    async def chat_completion(
        self,
        model: str,
        messages: list[dict],
        max_tokens: int = 4096,
        temperature: float = 0.7,
        stream: bool = False
    ) -> dict:
        pass

    @abstractmethod
    async def chat_completion_stream(
        self,
        model: str,
        messages: list[dict],
        max_tokens: int = 4096,
        temperature: float = 0.7
    ):
        pass

    def calculate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        return 0.0


class ProviderRegistry:
    _providers: dict[str, LLMProvider] = {}

    @classmethod
    def register(cls, provider: LLMProvider) -> None:
        cls._providers[provider.name] = provider

    @classmethod
    def get(cls, name: str) -> Optional[LLMProvider]:
        return cls._providers.get(name)

    @classmethod
    def get_for_model(cls, model: str) -> Optional[LLMProvider]:
        for provider in cls._providers.values():
            if model in provider.supported_models:
                return provider
        return None

    @classmethod
    def list_providers(cls) -> list[str]:
        return list(cls._providers.keys())
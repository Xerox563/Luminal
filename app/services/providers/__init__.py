from app.services.providers.base import ProviderRegistry
from app.services.providers.openai import OpenAIProvider
from app.services.providers.anthropic import AnthropicProvider
from app.services.providers.deepseek import DeepSeekProvider
from app.services.providers.nvidia import NvidiaProvider
from app.services.providers.ollama import OllamaProvider
from app.services.providers.openrouter import OpenRouterProvider


def init_providers():
    ProviderRegistry.register(OpenAIProvider())
    ProviderRegistry.register(AnthropicProvider())
    ProviderRegistry.register(DeepSeekProvider())
    ProviderRegistry.register(NvidiaProvider())
    ProviderRegistry.register(OllamaProvider())
    ProviderRegistry.register(OpenRouterProvider())
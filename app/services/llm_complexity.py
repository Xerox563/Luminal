from app.services.providers import ProviderRegistry
from app.models import ComplexityLevel
from app.core.config import settings
from app.services import runtime_settings


COMPLEXITY_PROMPT = """Classify the complexity of this user prompt as LOW, MEDIUM, or HIGH.

LOW: Simple factual questions, basic definitions, short queries
MEDIUM: Explanations, summaries, comparisons, multi-step instructions
HIGH: Analysis, synthesis, creative writing, coding, research, complex reasoning

Prompt: "{prompt}"

Respond with only: LOW, MEDIUM, or HIGH"""


async def score_complexity_llm(prompt: str) -> ComplexityLevel:
    default_provider = runtime_settings.get_setting("default_provider") or settings.default_provider or "ollama"

    provider_name = default_provider
    provider = ProviderRegistry.get(provider_name)
    if not provider:
        provider = ProviderRegistry.get("ollama") or ProviderRegistry.get("openrouter") or ProviderRegistry.get("openai")
    if not provider:
        from app.services.complexity import score_complexity
        return score_complexity(prompt)

    if provider_name == "ollama":
        complexity_model = "mistral:latest"
    else:
        complexity_model = "anthropic/claude-3-haiku"

    try:
        result = await provider.chat_completion(
            model=complexity_model,
            messages=[{"role": "user", "content": COMPLEXITY_PROMPT.format(prompt=prompt)}],
            max_tokens=10,
            temperature=0
        )
        response = result["content"].strip().upper()
        if "HIGH" in response:
            return ComplexityLevel.HIGH
        elif "MEDIUM" in response:
            return ComplexityLevel.MEDIUM
        else:
            return ComplexityLevel.LOW
    except Exception:
        from app.services.complexity import score_complexity
        return score_complexity(prompt)
from app.models import ComplexityLevel


HIGH_COMPLEXITY_KEYWORDS = [
    "analyze", "compare", "evaluate", "synthesize", "design", "architect",
    "optimize", "debug", "refactor", "implement", "create", "build",
    "develop", "research", "investigate", "prove", "derive", "calculate",
    "simulate", "model", "forecast", "predict", "strategy", "plan"
]

MEDIUM_COMPLEXITY_KEYWORDS = [
    "explain", "describe", "summarize", "list", "outline", "define",
    "identify", "classify", "categorize", "differentiate", "distinguish",
    "illustrate", "demonstrate", "interpret", "translate", "convert"
]

LOW_COMPLEXITY_KEYWORDS = [
    "what", "who", "when", "where", "which", "is", "are", "was", "were",
    "simple", "basic", "easy", "quick", "short", "brief"
]


def score_complexity(prompt: str) -> ComplexityLevel:
    prompt_lower = prompt.lower()
    word_count = len(prompt.split())
    
    high_score = sum(1 for kw in HIGH_COMPLEXITY_KEYWORDS if kw in prompt_lower)
    medium_score = sum(1 for kw in MEDIUM_COMPLEXITY_KEYWORDS if kw in prompt_lower)
    low_score = sum(1 for kw in LOW_COMPLEXITY_KEYWORDS if kw in prompt_lower)
    
    if word_count > 200 or high_score >= 2 or (high_score >= 1 and word_count > 20):
        return ComplexityLevel.HIGH
    elif word_count > 50 or high_score >= 1 or medium_score >= 1:
        return ComplexityLevel.MEDIUM
    elif low_score >= 2 or word_count < 10:
        return ComplexityLevel.LOW
    else:
        return ComplexityLevel.MEDIUM
import pytest
from app.services.complexity import score_complexity
from app.models import ComplexityLevel


def test_low_complexity_short_question():
    prompt = "What is 2+2?"
    assert score_complexity(prompt) == ComplexityLevel.LOW


def test_low_complexity_simple_question():
    prompt = "Who is the president?"
    assert score_complexity(prompt) == ComplexityLevel.LOW


def test_medium_complexity_explain():
    prompt = "Explain how photosynthesis works in plants."
    assert score_complexity(prompt) == ComplexityLevel.MEDIUM


def test_medium_complexity_summarize():
    prompt = "Summarize the key points of the article about climate change."
    assert score_complexity(prompt) == ComplexityLevel.MEDIUM


def test_high_complexity_analyze():
    prompt = "Analyze the economic impact of AI on the job market over the next decade, considering both positive and negative effects, and provide recommendations for policymakers."
    assert score_complexity(prompt) == ComplexityLevel.HIGH


def test_high_complexity_long_prompt():
    prompt = " ".join(["word"] * 250)
    assert score_complexity(prompt) == ComplexityLevel.HIGH


def test_high_complexity_multiple_keywords():
    prompt = "Design and implement a system to optimize database queries and debug performance issues."
    assert score_complexity(prompt) == ComplexityLevel.HIGH